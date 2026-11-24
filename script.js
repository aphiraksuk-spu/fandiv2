/* ==========================================================
   Fan Di — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจาก element ที่มีในหน้า แล้วเริ่มทำงานเฉพาะส่วนนั้น
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */
(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPrice(value) {
    var n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString('th-TH');
  }

  /* ==========================================================
     1) product.html — โหลดสินค้า + ปุ่มกรอง
     ========================================================== */
  var MOOD_LABELS = {
    fresh: 'Fresh',
    sweet: 'Sweet',
    confident: 'Confident',
    romance: 'Romance'
  };

  var FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'salt', label: 'Salt' },
    { key: 'charcoal', label: 'Charcoal' },
    { key: 'mint', label: 'Mint' }
  ];

  // key ตรงกับชื่อสินค้า (Salt/Charcoal/Mint) หรือตรงกับ field mood ก็ได้
  function productMatches(product, key) {
    if (key === 'all') return true;
    return (
      String(product.mood).toLowerCase() === key ||
      String(product.name).toLowerCase().indexOf(key) !== -1
    );
  }

  function buildOrderUrl(product) {
    var params = new URLSearchParams();
    params.set('item', product.name + ' ' + product.size);
    params.set('price', product.price);
    return 'order.html?' + params.toString();
  }

  function productCardHtml(p) {
    var moodLabel = MOOD_LABELS[p.mood] || p.mood;
    return (
      '<article class="product-card" data-mood="' + escapeHtml(p.mood) + '">' +
        '<div class="product-card__image">' +
          '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name + ' ' + p.size) + '" loading="lazy">' +
        '</div>' +
        '<div class="product-card__body">' +
          '<div class="product-card__mood"><span class="mood-dot"></span>' + escapeHtml(moodLabel) + '</div>' +
          '<h3 class="product-card__name">' + escapeHtml(p.name) + '</h3>' +
          '<p class="product-card__size">ขนาด ' + escapeHtml(p.size) + '</p>' +
          '<div class="product-card__footer">' +
            '<span class="product-card__price">' + escapeHtml(formatPrice(p.price)) + '<small>บาท</small></span>' +
            '<a class="btn btn--cork" href="' + escapeHtml(buildOrderUrl(p)) + '">สั่งซื้อ</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function initProductPage() {
    var list = document.getElementById('product-list');
    var bar = document.getElementById('filter-bar');
    if (!list || !bar) return;

    var products = [];
    var current = 'all';

    function renderList() {
      var shown = products.filter(function (p) {
        return productMatches(p, current);
      });
      list.innerHTML = shown.length
        ? shown.map(productCardHtml).join('')
        : '<p class="text-center">ไม่พบสินค้าในหมวดนี้</p>';
    }

    function updateButtons() {
      Array.prototype.forEach.call(bar.querySelectorAll('.chip'), function (btn) {
        var active = btn.getAttribute('data-filter') === current;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function setFilter(key) {
      current = key;
      updateButtons();
      renderList();
      // อัปเดต URL ให้แชร์ลิงก์ที่กรองไว้ได้ (ไม่เพิ่มประวัติย้อนกลับ)
      try {
        var url = new URL(window.location.href);
        if (key === 'all') url.searchParams.delete('mood');
        else url.searchParams.set('mood', key);
        window.history.replaceState(null, '', url);
      } catch (e) { /* ไม่เป็นไร */ }
    }

    // สร้างปุ่มกรอง
    bar.innerHTML = FILTERS.map(function (f) {
      return '<button type="button" class="chip" data-filter="' + f.key + '">' + escapeHtml(f.label) + '</button>';
    }).join('');
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (btn) setFilter(btn.getAttribute('data-filter'));
    });

    // กรองอัตโนมัติจาก ?mood=xxx
    var moodParam = new URLSearchParams(window.location.search).get('mood');
    if (moodParam) current = moodParam.trim().toLowerCase();

    list.innerHTML = '<p class="text-center">กำลังโหลดสินค้า...</p>';
    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        updateButtons();
        renderList();
      })
      .catch(function (error) {
        console.error(error);
        list.innerHTML = '<p class="text-center">โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>';
      });
  }

  /* ==========================================================
     2) order.html — เติมฟอร์มจาก URL + ส่งข้อมูลไป Apps Script
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    var itemsInput = document.getElementById('items');
    var totalInput = document.getElementById('total');

    // เติมชื่อสินค้า (#items) และราคา (#total) ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');
    if (itemsInput && item !== null) itemsInput.value = item;
    if (totalInput && price !== null) totalInput.value = price;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var payload = {
        customerName: document.getElementById('customerName').value.trim(),
        contact: document.getElementById('contact').value.trim(),
        items: document.getElementById('items').value.trim(),
        total: document.getElementById('total').value.trim(),
        note: document.getElementById('note').value.trim()
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch('https://script.google.com/macros/s/AKfycbxf1pYCQ0Y8IqMvEX9vF8pMAh6RVs7H4e5jsUUityMh4ZxmPVU4ZL203yeGgrND95uo/exec', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        if (submitBtn) submitBtn.disabled = false;
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
    });
  }

  /* ==========================================================
     3) admin.html — ดึง CSV จาก Google Sheets แสดงเป็นตาราง
     ========================================================== */
  var SHEET_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQxqL1Rwt1MnUXiIAXk-uUJbvoDU4tL5Pn8xj8X_nOrkEWCII-4SSH0PjLynrJdcm3UB9SjSAH_eQG1/pub?gid=0&single=true&output=csv';

  // parse CSV เอง: รองรับเครื่องหมายคำพูด, "" (quote ซ้อน), คอมมา/ขึ้นบรรทัดใหม่ในช่อง, CRLF และ BOM
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    text = text.replace(/^\uFEFF/, '');

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function initAdminPage() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    function message(text) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">' + escapeHtml(text) + '</td></tr>';
    }

    message('กำลังโหลดข้อมูล...');

    fetch(SHEET_CSV_URL + '&_=' + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // ตัดแถวหัวตาราง

        // ตัดแถวว่าง แล้วกลับลำดับ: รายการล่าสุด (ท้ายชีต) ขึ้นก่อน
        rows = rows
          .filter(function (r) {
            return r.some(function (cell) { return cell.trim() !== ''; });
          })
          .reverse();

        if (!rows.length) {
          message('ยังไม่มีรายการสั่งซื้อ');
          return;
        }

        // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
        tbody.innerHTML = rows.map(function (r) {
          var cells = [];
          for (var i = 0; i < 6; i++) {
            var value = r[i] == null ? '' : r[i];
            if (i === 4) value = formatPrice(value);
            cells.push('<td>' + escapeHtml(value) + '</td>');
          }
          return '<tr>' + cells.join('') + '</tr>';
        }).join('');
      })
      .catch(function (error) {
        console.error(error);
        message('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ---------- Start ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
