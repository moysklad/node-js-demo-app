export const documentButtonNames = ["show-notification", "navigate-to", "show-popup"] as const;
export const listButtonNames = ["show-notification"] as const;
export const allButtonNames = [...documentButtonNames] as const;

export type DocumentButtonName = (typeof documentButtonNames)[number];
export type ListButtonName = (typeof listButtonNames)[number];

export type ButtonUser = {
  role?: string;
};

export type ListButtonObject = {
  id: string;
};

export type ButtonActionResponse =
  | {}
  | {
      action: "showNotification";
      params: {
        text: string;
      };
    }
  | {
      action: "navigateTo";
      params: {
        url: string;
      };
    }
  | {
      action: "showPopup";
      params: {
        popupName: string;
        popupParameters: {
          paramStr: string;
          paramInt: number;
        };
      };
    };

export function processDocumentButtonClick(
  buttonName: DocumentButtonName,
  extensionPoint: string,
  objectId: string,
  user?: ButtonUser
): ButtonActionResponse {
  if (buttonName === "show-notification") {
    return {
      action: "showNotification",
      params: {
        text: `Кнопка нажата в '${extensionPoint}' для объекта с ИД '${objectId}' пользователем с ролью ${user?.role ?? ""}`,
      },
    };
  }

  if (buttonName === "navigate-to") {
    return {
      action: "navigateTo",
      params: {
        url: "https://api.whatsapp.com/send/?phone=%2B79127775533",
      },
    };
  }

  if (buttonName === "show-popup") {
    return {
      action: "showPopup",
      params: {
        popupName: "some-popup",
        popupParameters: { paramStr: "Hello", paramInt: 777 },
      },
    };
  }

  return {};
}

export function processListButtonClick(
  buttonName: ListButtonName,
  extensionPoint: string,
  objects: ListButtonObject[]
): ButtonActionResponse {
  if (buttonName !== "show-notification") {
    return {};
  }

  const items = objects.map((item) => `'${item.id}'`).join(", ");

  return {
    action: "showNotification",
    params: {
      text: `Кнопка нажата в '${extensionPoint}' для объектов ${items}`,
    },
  };
}
