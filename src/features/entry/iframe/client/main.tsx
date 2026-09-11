import { mount, mountElement, tryReadPageData } from "../../ui/mount";
import { sdk } from "../../ui/sdk";
import type { IframePageData } from "../page-data";
import { ContextBootstrap } from "./ContextBootstrap";
import { IframePage } from "./IframePage";

// Высота iframe подстраивается под содержимое: SDK следит за размером документа сам.
sdk.autoResizeIframe();

const pageData = tryReadPageData<IframePageData>();

if (pageData) {
  mount<IframePageData>(IframePage);
} else {
  mountElement(<ContextBootstrap />);
}
