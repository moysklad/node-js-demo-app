import { config } from "../lib/config/config";
// [feature:scenario] действия в сценариях: список действий общий с обработчиком.
import { SCENARIO_ACTIONS } from "../scenario/domain/scenario-event";

export function buildDescriptorXml(): string {
  const scenarioActions = Object.entries(SCENARIO_ACTIONS)
    .map(([name, title]) => `        <action name="${escapeXml(name)}" title="${escapeXml(title)}"/>`)
    .join("\n");

  // [feature:loyalty] программа лояльности: <loyaltyApi/> — только «пропуск» на PUT .../loyalty
  // (без него Vendor API отвечает ошибкой 2006), сам по себе программу лояльности не включает.
  return `<?xml version="1.0" encoding="UTF-8"?>
<ServerApplication xmlns="https://apps-api.moysklad.ru/xml/ns/appstore/app/v2"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xsi:schemaLocation="https://apps-api.moysklad.ru/xml/ns/appstore/app/v2 https://apps-api.moysklad.ru/xml/ns/appstore/app/v2/application-v2.xsd">
    <iframes>
        <iframe type="main" sourceUrl="${config.appBaseUrl}/entry/iframe" useContextKey="false">
            <uses>
                <user-context/>
            </uses>
        </iframe>
        <iframe type="chat" sourceUrl="${config.appBaseUrl}/entry/iframe-chat" useContextKey="false">
            <uses>
                <user-context/>
            </uses>
        </iframe>
    </iframes>
    <vendorApi>
        <endpointBase>${config.appBaseUrl}/vendor-endpoint</endpointBase>
    </vendorApi>
    <loyaltyApi/>
    <access>
        <resource>https://api.moysklad.ru/api/remap/1.2</resource>
        <scope>admin</scope>
    </access>
    <widgets>
        <document.customerorder.edit useContextKey="false">
            <sourceUrl>${config.appBaseUrl}/entry/widget-customerorder</sourceUrl>
            <height>
                <fixed>525px</fixed>
            </height>
            <supports>
                <open-feedback/>
                <dirty-state/>
                <save-handler/>
                <update-provider/>
                <change-handler>
                    <validation-feedback/>
                </change-handler>
            </supports>
            <uses>
                <good-folder-selector/>
                <standard-dialogs/>
                <navigation-service/>
                <user-context/>
            </uses>
        </document.customerorder.edit>
        <document.invoiceout.edit useContextKey="false">
            <sourceUrl>${config.appBaseUrl}/entry/widget-invoiceout</sourceUrl>
            <height>
                <fixed>525px</fixed>
            </height>
            <supports>
                <open-feedback/>
                <dirty-state/>
                <save-handler/>
                <update-provider/>
                <change-handler>
                    <validation-feedback/>
                </change-handler>
            </supports>
            <uses>
                <good-folder-selector/>
                <standard-dialogs/>
                <navigation-service/>
                <user-context/>
            </uses>
        </document.invoiceout.edit>
    </widgets>
    <popups>
        <popup>
            <name>some-popup</name>
            <sourceUrl>${config.appBaseUrl}/entry/popup</sourceUrl>
            <uses>
                <good-folder-selector/>
                <standard-dialogs/>
                <navigation-service/>
            </uses>
        </popup>
    </popups>
    <buttons>
        <button name="show-notification" title="Отобразить уведомление">
            <locations>
                <document.customerorder.edit/>
                <document.customerorder.list/>
            </locations>
        </button>
        <button name="navigate-to" title="Открыть ссылку">
            <locations>
                <document.customerorder.edit/>
            </locations>
        </button>
        <button name="show-popup" title="Открыть popup">
            <locations>
                <document.customerorder.edit/>
            </locations>
        </button>
    </buttons>
    <scenario>
${scenarioActions}
    </scenario>
</ServerApplication>`;
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
