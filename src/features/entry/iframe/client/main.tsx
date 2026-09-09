import { mount } from "../../ui/mount";
import { sdk } from "../../ui/sdk";
import type { IframePageData } from "../page-data";
import { IframePage } from "./IframePage";

// Высота iframe подстраивается под содержимое: SDK следит за размером документа сам.
sdk.autoResizeIframe();

mount<IframePageData>(IframePage);
