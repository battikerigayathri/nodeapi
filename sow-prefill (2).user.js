// ==UserScript==
// @name         CSOD SOW Prefill
// @namespace    http://tampermonkey.net/
// @version      9.0
// @description  Prefills SOW form using token from Hash
// @match        https://vithiit-careers-dev.mercuryx.cloud/dashboard/page/create-csod-sow*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";
    const NODE_SERVER = "https://nodeapi-vriz.onrender.com";

    function setReactValue(el, val) {
        if (!el) return;
        el.focus();
        const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
        setter.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.blur();
    }

    function doPrefill(data) {
        console.log("[SOW] Starting prefill with data:", data);
        const p = data.parent_input || {};
        const li = data.lines_input || data.line_items || [];

        // 1. Fill Parent Fields
        const phFields = {
            "PO Number": p.poNumber || p.po_number,
            "Client Manager": p.clientManager,
            "Client Manager Email": p.clientManagerEmail,
            "Customer Account Number": p.customerAccNumber
        };

        Object.keys(phFields).forEach(ph => {
            setReactValue(document.querySelector(`input[placeholder*="${ph}"]`), phFields[ph]);
        });

        setReactValue(document.querySelector('input[type="date"]'), p.date || p.order_date);
        setReactValue(document.querySelectorAll("select")[0], p.currency || "USD");

        // 2. Handle Dynamic Rows
        const existing = document.querySelectorAll('input[placeholder*="Line Item Number"]').length;
        if (li.length > existing) {
            const addBtn = document.querySelector('svg:last-of-type')?.parentElement;
            for (let i = 0; i < (li.length - existing); i++) { addBtn?.click(); }
            setTimeout(() => fillRows(li), 800);
        } else {
            fillRows(li);
        }
    }

    function fillRows(li) {
        const rows = document.querySelectorAll('input[placeholder*="Line Item Number"]');
        const descs = document.querySelectorAll('input[placeholder*="Line Item Description"]');
        const prices = document.querySelectorAll('input[placeholder*="Price"]');
        const qtys = document.querySelectorAll('input[placeholder*="Quantity"]');
        const bills = document.querySelectorAll('select[id^="billing-"]');

        li.forEach((item, i) => {
            if (rows[i]) {
                setReactValue(rows[i], item.lineItemNumber);
                setReactValue(descs[i], item.description);
                setReactValue(prices[i], item.price);
                setReactValue(qtys[i], item.quantity);
                setReactValue(bills[i], item.billing || "PER_HOUR");
            }
        });
        console.log("[SOW] Prefill Finished");
    }

    function init() {
        const hashToken = window.location.hash.includes("sow_token=") 
            ? window.location.hash.split("sow_token=")[1].split("&")[0] 
            : null;

        if (hashToken) {
            console.log("[SOW] Token detected in hash:", hashToken);
            GM_xmlhttpRequest({
                method: "GET",
                url: `${NODE_SERVER}/sow-data/${hashToken}`,
                onload: (r) => {
                    try {
                        const res = JSON.parse(r.responseText);
                        if (res.success) {
                            // Wait for the specific field to exist before filling
                            const checkForm = setInterval(() => {
                                if (document.querySelector('input[placeholder*="PO Number"]')) {
                                    clearInterval(checkForm);
                                    doPrefill(res.data);
                                }
                            }, 500);
                        }
                    } catch (e) { console.error("[SOW] Parse error", e); }
                }
            });
        }
    }

    init();
})();