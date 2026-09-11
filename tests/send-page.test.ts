import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";
import { sendPage } from "../src/lib/http/send-page";

function fakeResponse(): { res: Response; sent: () => string; contentType: () => string } {
  let body = "";
  let type = "";
  const res = {
    type(value: string) {
      type = value;
      return res;
    },
    send(value: string) {
      body = value;
      return res;
    }
  } as unknown as Response;

  return { res, sent: () => body, contentType: () => type };
}

test("sendPage renders root, page data and bundle", () => {
  const { res, sent, contentType } = fakeResponse();

  sendPage(res, { title: "Demo <iframe>", bundle: "iframe", pageData: { uid: "u", html: "</script>" } });

  const html = sent();
  assert.equal(contentType(), "html");
  assert.match(html, /<title>Demo &#60;iframe&#62;<\/title>/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="application\/json" id="page-data">\{"uid":"u","html":"\\u003c\/script>"\}<\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/entry\/iframe.css">/);
  assert.match(html, /<script type="module" src="\/assets\/entry\/iframe.js"><\/script>/);
});

test("sendPage without page data omits the page-data script", () => {
  const { res, sent } = fakeResponse();

  sendPage(res, { title: "Popup", bundle: "popup" });

  assert.doesNotMatch(sent(), /page-data/);
  assert.match(sent(), /popup\.js/);
});
