import "../../ui/prevent-focus-scroll";
import { mountElement } from "../../ui/mount";
import { sdk } from "../../ui/sdk";
import type { IframePageData } from "../page-data";
import { ContextBootstrap } from "./ContextBootstrap";
import { IframePage } from "./IframePage";

// Высота iframe подстраивается под содержимое: SDK следит за размером документа сам.
sdk.autoResizeIframe();

mountElement(<ContextBootstrap<IframePageData> page="iframe" render={(data) => <IframePage data={data} />} />);
