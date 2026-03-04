// ==UserScript==
// @name         CSOD SOW Prefill (Window.Name Based)
// @match        https://vithiit-careers-dev.mercuryx.cloud/dashboard/page/create-csod-sow*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  console.log("[SOW] Prefill Script Loaded");

  function setReactValue(el, value) {
    if (!el || value == null) return;

    el.focus();

    const prototype =
      el.tagName === "SELECT"
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    ).set;

    setter.call(el, value);

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    el.blur();
  }

  function fillForm(data) {
    console.log("[SOW] Filling form with:", data);

    const p = data.parent_input || {};
    const li = data.lines_input || [];

    // -------------------------
    // Parent Fields
    // -------------------------

    setReactValue(
      document.querySelector('input[placeholder*="PO Number"]'),
      p.poNumber
    );

    setReactValue(
      document.querySelector('input[type="date"]'),
      p.date
    );

    setReactValue(
      document.querySelector('input[placeholder*="Client Manager"]'),
      p.clientManager
    );

    setReactValue(
      document.querySelector('input[placeholder*="Client Manager Email"]'),
      p.clientManagerEmail
    );

    setReactValue(
      document.querySelector('input[placeholder*="Customer Account Number"]'),
      p.customerAccNumber
    );

    setReactValue(
      document.querySelector("select"),
      p.currency || "USD"
    );

    // -------------------------
    // Handle Line Items
    // -------------------------

    const existingRows = document.querySelectorAll(
      'input[placeholder*="Line Item Number"]'
    ).length;

    const addBtn =
      document.querySelector('svg[data-testid="AddIcon"]')?.parentElement;

    if (li.length > existingRows && addBtn) {
      for (let i = 0; i < li.length - existingRows; i++) {
        addBtn.click();
      }
    }

    setTimeout(() => {
      const rows = document.querySelectorAll(
        'input[placeholder*="Line Item Number"]'
      );

      li.forEach((item, index) => {
        if (!rows[index]) return;

        const container = rows[index].closest("tr") || rows[index].parentElement.parentElement;

        const inputs = container.querySelectorAll("input");

        setReactValue(inputs[0], item.lineItemNumber);
        setReactValue(inputs[1], item.description);
        setReactValue(inputs[2], item.price);
        setReactValue(inputs[3], item.quantity);
      });

      console.log("[SOW] Prefill Completed");
    }, 800);
  }

  function waitForForm(data) {
    const interval = setInterval(() => {
      const poField = document.querySelector(
        'input[placeholder*="PO Number"]'
      );

      if (poField) {
        clearInterval(interval);
        fillForm(data);
      }
    }, 500);
  }

  function init() {
    if (!window.name) {
      console.warn("[SOW] No window.name data found");
      return;
    }

    try {
      const parsed = JSON.parse(window.name);

      if (parsed.__sow__) {
        console.log("[SOW] Data detected from window.name");
        waitForForm(parsed.__sow__);
      }
    } catch (e) {
      console.error("[SOW] Failed to parse window.name", e);
    }
  }

  init();
})();