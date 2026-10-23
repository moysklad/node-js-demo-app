import "../../ui/prevent-focus-scroll";
import { ContextBootstrap } from "../../iframe/client/ContextBootstrap";
import { mountElement } from "../../ui/mount";
import type { ChatPageData } from "../page-data";
import { ChatPage } from "./ChatPage";

// Хост чатов высоту окна не подстраивает, autoResizeIframe здесь не вызываем: страница скроллится сама.
mountElement(<ContextBootstrap<ChatPageData> page="chat" render={(data) => <ChatPage data={data} />} />);
