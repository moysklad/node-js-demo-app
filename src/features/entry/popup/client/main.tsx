import { mountPage } from "../../ui/mount";
import { sdk } from "../../ui/sdk";
import { PopupPage } from "./PopupPage";

sdk.autoResizeIframe();

mountPage(PopupPage);
