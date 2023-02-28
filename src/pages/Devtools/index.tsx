import {
  Col,
  Divider,
  Empty,
  Layout,
  Menu,
  message,
  Row,
  Tooltip,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import ConsolePanel from './ConsolePanel';
import NetworkPanel from './NetworkPanel';
import SystemPanel from './SystemPanel';
import { WSProvider } from './WSInfo';
import { useNavigate, useLocation } from 'react-router-dom';
import PagePanel from './PagePanel';
import { DownOutlined } from '@ant-design/icons';
// os
import PCSvg from '@/assets/image/pc.svg';
import IOSSvg from '@/assets/image/apple.svg';
import AndroidSvg from '@/assets/image/android.svg';
// browser
import GoogleSvg from '@/assets/image/google.svg';
import SafariSvg from '@/assets/image/safari.svg';
import FirefoxSvg from '@/assets/image/firefox.svg';
import WechatSvg from '@/assets/image/wechat.svg';
import BrowserSvg from '@/assets/image/browser.svg';
import { useRequest } from 'ahooks';
import { getSpyRoom } from '@/apis';
import clsx from 'classnames';
import './index.less';
import { StoragePanel } from './StoragePanel';
import useSearch from '@/utils/useSearch';
import { useEventListener } from '@/utils/useEventListener';
import classNames from 'classnames';

const { Sider, Content } = Layout;
const { Title } = Typography;

const MENUS = {
  Console: ConsolePanel,
  Network: NetworkPanel,
  System: SystemPanel,
  Page: PagePanel,
  Storage: StoragePanel,
};
type MenuKeys = keyof typeof MENUS;

const LOGO = {
  // os
  IOS: IOSSvg,
  Android: AndroidSvg,
  // browser
  Chrome: GoogleSvg,
  Firefox: FirefoxSvg,
  Safari: SafariSvg,
  Weixin: WechatSvg,
};
type LogoBrand = keyof typeof LOGO;

function resolveClientInfo(data: string) {
  const [os, browser] = data.split('-');
  const [name, ver = 'Unknown'] = browser.split(':');
  return {
    osName: os,
    osLogo: LOGO[os as LogoBrand] || PCSvg,
    browserLogo: LOGO[name as LogoBrand] || BrowserSvg,
    browserName: name,
    browserVersion: ver,
  };
}

interface BadgeMenuProps {
  active: MenuKeys;
}
const BadgeMenu = ({ active }: BadgeMenuProps) => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [badge, setBadge] = useState<Record<MenuKeys, boolean>>({
    Console: false,
    Network: false,
    Page: false,
    Storage: false,
    System: false,
  });
  useEventListener('page-spy-updated', (evt) => {
    const { detail } = evt as CustomEvent;
    const type = `${(detail as string)[0].toUpperCase()}${detail.slice(
      1,
    )}` as MenuKeys;
    if (type !== active) {
      setBadge({
        ...badge,
        [type]: true,
      });
    }
  });

  useEffect(() => {
    setBadge((prev) => ({
      ...prev,
      [active]: false,
    }));
  }, [active]);

  return (
    <Menu mode="inline" selectedKeys={[active]}>
      {Object.keys(MENUS).map((item) => (
        <Menu.Item
          key={item}
          onClick={() => {
            navigate({ search, hash: item });
          }}
        >
          <span data-i18n-skip>{item}</span>
          <div
            className={classNames('circle-badge', {
              show: badge[item as MenuKeys],
            })}
          />
        </Menu.Item>
      ))}
    </Menu>
  );
};

interface SiderRoomProps {
  exclude: string;
}
const SiderRooms: React.FC<SiderRoomProps> = ({ exclude }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { group } = useSearch();
  const { data } = useRequest(
    async () => {
      const res = await getSpyRoom(group);
      return res.data.filter((item) => {
        return (
          item.address !== exclude &&
          item.connections &&
          item.connections.length > 0
        );
      });
    },
    {
      pollingInterval: 2000,
      pollingWhenHidden: false,
      onError(err) {
        message.error(err.message);
      },
    },
  );

  const rooms = useMemo(() => {
    const result =
      data
        ?.filter((item) => item.name && item.address)
        .map((item) => {
          const { osLogo, browserLogo } = resolveClientInfo(item.name);
          return {
            osLogo,
            browserLogo,
            name: item.name,
            address: item.address,
            group: item.group,
          };
        }) || [];
    if (result.length === 0) {
      return <Empty description={false} imageStyle={{ height: 50 }} />;
    }
    return result.map((item) => (
      <a
        key={item.address}
        className="room-item"
        href={`${window.location.origin}/debug?version=${item.name}&address=${item.address}&group=${item.group}`}
      >
        <div className="room-item__os">
          <img src={item.osLogo} className="client-icon" />
        </div>
        <div className="room-item__browser">
          <img src={item.browserLogo} className="client-icon" />
        </div>
        <div className="room-item__address">
          <code>{item.address.slice(0, 4)}</code>
        </div>
      </a>
    ));
  }, [data]);

  return (
    <div
      className={clsx('sider-rooms', {
        collapsed,
      })}
    >
      <div
        className="sider-rooms__title"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Title level={4}>Rooms</Title>
        <div className="trigger-icon">
          <DownOutlined />
        </div>
      </div>
      <div className="sider-rooms__content">
        <div className="room-list">{rooms}</div>
      </div>
    </div>
  );
};

export default function Devtools() {
  const { hash = '#Console' } = useLocation();
  const { version = '', address = '' } = useSearch();

  const clientInfo = useMemo(() => {
    if (!version) return null;
    return resolveClientInfo(version);
  }, [version]);

  const hashKey = useMemo<MenuKeys>(() => {
    const value = hash.slice(1);
    if (!(value in MENUS)) {
      return 'Console';
    }
    return value as MenuKeys;
  }, [hash]);

  const ActiveContent = useMemo(() => {
    const content = MENUS[hashKey];
    return content || ConsolePanel;
  }, [hashKey]);

  if (!(version && address)) {
    message.error('Error url params!');
    return null;
  }

  // eslint-disable-next-line consistent-return
  return (
    <WSProvider room={address}>
      <Layout className="page-spy-devtools">
        <Sider theme="light">
          <div className="page-spy-devtools__sider">
            <div className="client-info">
              <Title level={4}>Current</Title>
              <Row wrap={false} align="middle" style={{ textAlign: 'center' }}>
                <Tooltip title={clientInfo?.osName}>
                  <Col span={11}>
                    <img
                      className="client-info__logo"
                      src={clientInfo?.osLogo}
                    />
                  </Col>
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip
                  title={
                    <>
                      <span>Browser: {clientInfo?.browserName}</span>
                      <br />
                      <span>Version: {clientInfo?.browserVersion}</span>
                    </>
                  }
                >
                  <Col span={11}>
                    <img
                      className="client-info__logo"
                      src={clientInfo?.browserLogo}
                    />
                  </Col>
                </Tooltip>
              </Row>
              <Divider type="horizontal" style={{ margin: '8px 0' }}></Divider>
              <Tooltip title="PageSpy ID">
                <Row justify="center" className="page-spy-id">
                  <Col>
                    <b>{address.slice(0, 4)}</b>
                  </Col>
                </Row>
              </Tooltip>
            </div>
            <BadgeMenu active={hashKey} />
            <div className="page-spy-devtools__sider-bottom">
              <SiderRooms exclude={address} />
            </div>
          </div>
        </Sider>
        <Content>
          <div className="page-spy-devtools__panel">
            <ActiveContent />
          </div>
        </Content>
      </Layout>
    </WSProvider>
  );
}
