import React, { useState, useEffect, useMemo } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import "./App.css";
import c2tredsLogo from "./c2treds.png";

const InvoiceGenerator = () => {
  const [formData, setFormData] = useState({
    invoiceType: '',
    productType: '',
    numInvoices: 1,
    dueDateStart: '',
    dueDateEnd: ''
  });
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyers, setSelectedBuyers] = useState([]);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBuyers = async () => {
      try {
        const response = await fetch("/invoice-generator/buyers.json");
        if (!response.ok) throw new Error('Failed to load buyers');

        const data = await response.json();
        const processedData = data.map(buyer => ({
          ...buyer,
          buyer_pan: buyer.buyer_pan.split(',').map(s => s.trim()),
          buyer_gstin: buyer.buyer_gstin.split(',').map(s => s.trim()),
          supplier_pan: buyer.supplier_pan.split(',').map(s => s.trim()),
          supplier_gstin: buyer.supplier_gstin.split(',').map(s => s.trim())
        }));

        setBuyers(processedData);
      } catch (err) {
        setError('Failed to load buyer data!');
      } finally {
        setLoading(false);
      }
    };

    fetchBuyers();
  }, []);

  const filteredBuyers = useMemo(() => {
    const q = buyerSearch.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(b => b.buyer_name.toLowerCase().includes(q));
  }, [buyers, buyerSearch]);

  const allFilteredSelected = filteredBuyers.length > 0 &&
      filteredBuyers.every(b => selectedBuyers.includes(b.buyer_name));

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedBuyers(prev =>
          prev.filter(name => !filteredBuyers.some(b => b.buyer_name === name))
      );
    } else {
      const toAdd = filteredBuyers.map(b => b.buyer_name);
      setSelectedBuyers(prev => Array.from(new Set([...prev, ...toAdd])));
    }
  };

  const handleBuyerToggle = (buyerName) => {
    setSelectedBuyers(prev =>
        prev.includes(buyerName)
            ? prev.filter(n => n !== buyerName)
            : [...prev, buyerName]
    );
  };

  const generateCombinations = (buyer) => {
    const combinations = [];
    if (!buyer) return combinations;

    buyer.buyer_pan.forEach(bPan => {
      buyer.buyer_gstin.forEach(bGstin => {
        buyer.supplier_pan.forEach(sPan => {
          buyer.supplier_gstin.forEach(sGstin => {
            if (bPan && bGstin && sPan && sGstin) {
              combinations.push({
                buyerPan: bPan,
                buyerGstin: bGstin,
                sellerPan: sPan,
                sellerGstin: sGstin
              });
            }
          });
        });
      });
    });
    return combinations;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateUniqueId = (prefix) => {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // invoiceIndex: 0-based index of current invoice
  // totalInvoices: total number of invoices being generated
  const generateDates = (invoiceIndex = 0, totalInvoices = 1) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Posting Date / Invoice Date: always exactly 90 days before current date
    const postingDate = new Date(currentDate);
    postingDate.setDate(currentDate.getDate() - 90);

    // GRN Date: <= 45 days in past, < current_date
    const grnDaysAgo = 1 + Math.floor(Math.random() * 45);
    const grnDate = new Date(currentDate);
    grnDate.setDate(currentDate.getDate() - grnDaysAgo);

    // Due Date logic:
    // If user provides both dueDateStart and dueDateEnd → distribute invoices evenly across range
    // If only one or neither → auto-generate (random 1–180 days future)
    let paymentDueDate;
    if (formData.dueDateStart && formData.dueDateEnd) {
      const start = new Date(formData.dueDateStart);
      const end = new Date(formData.dueDateEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const spanMs = end.getTime() - start.getTime();
      // Evenly space: invoice 0 → start, last invoice → end
      // If only 1 invoice → use start date
      const step = totalInvoices > 1 ? spanMs / (totalInvoices - 1) : 0;
      paymentDueDate = new Date(start.getTime() + Math.round(step * invoiceIndex));
    } else {
      const dueDaysAhead = 1 + Math.floor(Math.random() * 180);
      paymentDueDate = new Date(currentDate);
      paymentDueDate.setDate(currentDate.getDate() + dueDaysAhead);
    }

    // Transaction Date: <= 90 days in past, >= posting_date, < current_date
    const txDaysAgo = 1 + Math.floor(Math.random() * 90);
    const transactionDate = new Date(currentDate);
    transactionDate.setDate(currentDate.getDate() - txDaysAgo);
    if (transactionDate < postingDate) {
      transactionDate.setTime(postingDate.getTime());
    }

    // Pay Date: ERP and C2FO → current_date + 1; Manual upload → random future
    let payDate;
    if (formData.invoiceType === 'ERP' || formData.invoiceType === 'C2FO') {
      payDate = new Date(currentDate);
      payDate.setDate(currentDate.getDate() + 1);
    } else {
      const payDaysAhead = 1 + Math.floor(Math.random() * 180);
      payDate = new Date(currentDate);
      payDate.setDate(currentDate.getDate() + payDaysAhead);
    }

    return { postingDate, grnDate, transactionDate, paymentDueDate, payDate };
  };

  // Realistic Amount Generator: ₹1,00,000 – ₹10,00,000
  const generateRealisticAmount = () => {
    const lakhBase = 1 + Math.random() * 9;
    const baseAmount = Math.floor(lakhBase * 100000);

    if (Math.random() < 0.5) {
      return Math.round(baseAmount / 1000) * 1000;
    } else {
      const rounded = Math.floor(baseAmount / 1000) * 1000;
      const remainder = 100 + Math.floor(Math.random() * 900);
      return rounded + remainder;
    }
  };

  const generateCSVForBuyer = (buyer) => {
    const combinations = generateCombinations(buyer);
    if (combinations.length === 0) return null;

    let headers = [];
    const csvData = [];
    const baseVoucherId = 510000000;
    const totalInvoices = formData.numInvoices;

    combinations.forEach(combination => {
      if (formData.invoiceType === 'ERP') {
        headers = [
          'company_id', 'company_name', 'company_gstin', 'company_pan', 'buyer_tax_id', 'buyer_pan',
          'invoice_id', 'amount', 'currency', 'transaction_date', 'grn_date', 'posting_date',
          'payment_due_date', 'transaction_type', 'voucher_id', 'voucher_line_id', 'fiscal_year',
          'adj_invoice_id', 'adj_reason_code', 'description', 'buyer_name', 'buyer_address',
          'sap_company_code', 'sap_reference_number', 'sap_vendor_number', 'credit_days',
          'sap_payment_term', 'market_type', 'treds_flag', 'sap_discount_base_amount', 'fp_status',
          'posting_key', 'document_type', 'business_place', 'product_type'
        ];

        const businessPlaces = [
          '1901|West Bengal Dabur',
          '0601|Haryana Dabur',
          '0201|Himachal Pradesh Dabur'
        ];

        for (let i = 1; i <= totalInvoices; i++) {
          // Pass 0-based index and total so due dates are distributed
          const dates = generateDates(i - 1, totalInvoices);

          const row = {
            company_id: `AJAYCOM${i.toString().padStart(3, '0')}`,
            company_name: i % 4 === 0 ? 'Innovative Tech Pack Limited' : 'SAMSON GLOBAL PRIVATE LIMITED SAMSON GLOBAL PRIVATE LIMITED',
            company_gstin: combination.sellerGstin,
            company_pan: combination.sellerPan,
            buyer_tax_id: combination.buyerGstin,
            buyer_pan: combination.buyerPan,
            invoice_id: generateUniqueId('INVID'),
            amount: generateRealisticAmount(),
            currency: 'INR',
            transaction_date: dates.transactionDate.toISOString().split('T')[0],
            grn_date: dates.grnDate.toISOString().split('T')[0],
            posting_date: dates.postingDate.toISOString().split('T')[0],
            payment_due_date: dates.paymentDueDate.toISOString().split('T')[0],
            transaction_type: 1,
            voucher_id: baseVoucherId + i,
            voucher_line_id: 1,
            fiscal_year: new Date().getFullYear(),
            adj_invoice_id: '',
            adj_reason_code: '',
            description: generateUniqueId('DESCRIPTION'),
            buyer_name: 'Dabur India Ltd.',
            buyer_address: '8/3 Asaf Ali Road|IN',
            sap_company_code: '1000',
            sap_reference_number: generateUniqueId('SAPREF'),
            sap_vendor_number: 110268,
            credit_days: 30,
            sap_payment_term: `Z${Math.random() < 0.5 ? 'C' : 'V'}${Math.floor(10 + Math.random() * 90)}`,
            market_type: 'TREDS',
            treds_flag: 'Y',
            sap_discount_base_amount: 10000,
            fp_status: 'Funded by TReDS',
            posting_key: 31,
            document_type: 'RE',
            business_place: businessPlaces[Math.floor(Math.random() * businessPlaces.length)],
            product_type: formData.productType === 'Normal' ? '' : formData.productType
          };
          csvData.push(row);
        }
      } else if (formData.invoiceType === 'Manual Upload') {
        headers = [
          'company_name', 'company_id', 'company_pan', 'buyer_pan', 'company_gstin', 'buyer_gstin',
          'invoice_id', 'invoice_date', 'invoice_acceptance_date', 'grn_date', 'due_date',
          'inv_amount', 'tax_amount', 'tds_amount', 'inv_amount_gross_tax', 'inv_amount_nettax',
          'po_id', 'transaction_type', 'po_date', 'inv_reference', 'grn_number', 'description',
          'credit_days', 'currency', 'product_type'
        ];

        for (let i = 1; i <= totalInvoices; i++) {
          const currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0);
          const dates = generateDates(i - 1, totalInvoices);

          const invoiceDate = new Date(dates.postingDate);

          const invoiceAcceptanceDate = new Date(invoiceDate);
          const acceptanceDays = 1 + Math.floor(Math.random() * 14);
          invoiceAcceptanceDate.setDate(invoiceDate.getDate() + acceptanceDays);
          if (invoiceAcceptanceDate > currentDate) {
            invoiceAcceptanceDate.setTime(currentDate.getTime());
          }

          const minAcceptanceDate = new Date(currentDate);
          minAcceptanceDate.setDate(currentDate.getDate() - 180);
          if (invoiceAcceptanceDate < minAcceptanceDate) {
            invoiceAcceptanceDate.setTime(minAcceptanceDate.getTime());
          }

          const companyIdNumber = 30 + i - 1;
          const company_id = `TAJAYFU${companyIdNumber}`;
          const invoice_id = generateUniqueId('INVID');

          const month = invoiceDate.toLocaleString('default', { month: 'short' }).toUpperCase();
          const year = invoiceDate.getFullYear().toString().slice(-2);
          const description = `BILL FOR THE M/O ${month}-${year} (${invoice_id})`;

          const invRefParts = [
            'R001',
            `511002${Math.floor(1000 + Math.random() * 9000)}`,
            '001',
            new Date().getFullYear(),
            `GST${1300 + i}/2024-25`
          ];
          const inv_reference = invRefParts.join('|');

          const row = {
            company_name: i % 2 === 0 ? 'SHAKTI TRADING CO.' : 'DURGESH BLOCK AND CHINA GLASS WORKS LTD.',
            company_id: company_id,
            company_pan: combination.sellerPan,
            buyer_pan: combination.buyerPan,
            company_gstin: combination.sellerGstin,
            buyer_gstin: combination.buyerGstin,
            invoice_id: generateUniqueId('INVID'),
            invoice_date: formatDate(invoiceDate),
            invoice_acceptance_date: formatDate(invoiceAcceptanceDate),
            grn_date: formatDate(dates.grnDate),
            due_date: formatDate(dates.paymentDueDate),
            inv_amount: generateRealisticAmount().toFixed(2),
            tax_amount: '',
            tds_amount: '',
            inv_amount_gross_tax: '',
            inv_amount_nettax: '',
            po_id: '',
            transaction_type: 1,
            po_date: '',
            inv_reference: inv_reference,
            grn_number: '',
            description: description,
            credit_days: 45,
            currency: 'INR',
            product_type: formData.productType === 'Normal' ? '' : formData.productType,
          };

          csvData.push(row);
        }
      } else {
        // C2FO
        headers = [
          'company_id', 'company_name', 'division_id', 'sap_reference_number', 'company_pan',
          'buyer_pan', 'company_tax_id', 'buyer_tax_id', 'posting_date', 'grn_date',
          'transaction_date', 'pay_date', 'payment_due_date', 'invoice_id', 'voucher_id',
          'voucher_line_id', 'amount', 'currency', 'discount_percentage', 'income',
          'discounted_invoice_amount', 'offer_apr_amount', 'transaction_type', 'fiscal_year',
          'adj_invoice_id', 'sequential_document_number', 'buyer_name', 'sap_vendor_number',
          'credit_days', 'sap_payment_term', 'fp_status', 'market_type', 'treds_flag',
          'sap_company_code', 'discount_reason_code', 'covers_adjustment', 'adj_invoice_amount',
          'product_type', 'description'
        ];

        for (let i = 1; i <= totalInvoices; i++) {
          const dates = generateDates(i - 1, totalInvoices);
          const amount = generateRealisticAmount();
          const discountPercentage = parseFloat((8 + Math.random() * 10).toFixed(2));
          const income = parseFloat((amount * discountPercentage / 100).toFixed(2));

          const row = {
            company_id: `AJAYCOMPANY${i.toString().padStart(2, '0')}`,
            company_name: `Company ${i}`,
            division_id: '',
            sap_reference_number: generateUniqueId('SAPREF'),
            company_pan: combination.sellerPan,
            buyer_pan: combination.buyerPan,
            company_tax_id: combination.sellerGstin,
            buyer_tax_id: combination.buyerGstin,
            posting_date: dates.postingDate.toISOString().split('T')[0],
            grn_date: dates.grnDate.toISOString().split('T')[0],
            transaction_date: dates.transactionDate.toISOString().split('T')[0],
            pay_date: dates.payDate.toISOString().split('T')[0],
            payment_due_date: dates.paymentDueDate.toISOString().split('T')[0],
            invoice_id: generateUniqueId('INVID'),
            voucher_id: baseVoucherId + i,
            voucher_line_id: 1,
            amount: amount,
            currency: 'INR',
            discount_percentage: discountPercentage,
            income: income,
            discounted_invoice_amount: (amount - income).toFixed(2),
            offer_apr_amount: parseFloat((Math.random() * (15 - 10) + 10).toFixed(1)),
            transaction_type: formData.productType === 'BIFactoring' ? 2 : 1,
            fiscal_year: new Date().getFullYear(),
            adj_invoice_id: '',
            sequential_document_number: `${formData.invoiceType}-Doc-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000000 + Math.random() * 9000000)}-${i.toString().padStart(2, '0')}`,
            buyer_name: 'Dabur India Ltd.',
            sap_vendor_number: Math.floor(100000 + Math.random() * 900000),
            credit_days: [30, 35, 40][Math.floor(Math.random() * 3)],
            sap_payment_term: `Z${Math.random() < 0.5 ? 'C' : 'V'}${Math.floor(10 + Math.random() * 90)}`,
            fp_status: 'Funded by TReDS',
            market_type: 'TREDS',
            treds_flag: 'Y',
            sap_company_code: '1000',
            discount_reason_code: '',
            covers_adjustment: '0',
            adj_invoice_amount: '',
            product_type: formData.productType === 'Normal' ? '' : formData.productType,
            description: generateUniqueId('DESCRIPTION'),
          };

          csvData.push(row);
        }
      }
    });

    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(field => row[field]).join(','))
    ].join('\n');

    return csv;
  };

  const generateCSV = async () => {
    setError('');

    if (selectedBuyers.length === 0) {
      setError('Please select at least one buyer');
      return;
    }
    if (!formData.invoiceType) {
      setError('Please select an invoice type');
      return;
    }
    if (!formData.productType) {
      setError('Please select a product type');
      return;
    }

    // Validate due date range if either field is filled
    if (formData.dueDateStart || formData.dueDateEnd) {
      if (!formData.dueDateStart || !formData.dueDateEnd) {
        setError('Please select both start and end due dates, or leave both blank to auto-generate');
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(formData.dueDateStart);
      const end = new Date(formData.dueDateEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (start <= today) {
        setError('Due date start must be a future date');
        return;
      }
      if (end <= start) {
        setError('Due date end must be after start date');
        return;
      }
    }

    const results = [];
    selectedBuyers.forEach(buyerName => {
      const buyer = buyers.find(b => b.buyer_name === buyerName);
      if (!buyer) return;
      const csv = generateCSVForBuyer(buyer);
      if (!csv) return;
      const safeName = buyerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      results.push({ safeName, csv });
    });

    if (results.length === 0) {
      setError('No valid buyer combinations found. Cannot generate CSV.');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);

    if (results.length === 1) {
      const blob = new Blob([results[0].csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `invoices_${results[0].safeName}_${timestamp}.csv`);
    } else {
      const zip = new JSZip();
      results.forEach(({ safeName, csv }) => zip.file(`invoices_${safeName}.csv`, csv));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `invoices_${timestamp}.zip`);
    }
  };

  if (loading) return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Loading buyer data…</span>
      </div>
  );

  const isReady = selectedBuyers.length > 0 && formData.invoiceType && formData.productType;

  // Compute due date span info for the hint text
  const dueDateSpanDays = formData.dueDateStart && formData.dueDateEnd
      ? Math.round(
          (new Date(formData.dueDateEnd) - new Date(formData.dueDateStart)) / 86400000
      )
      : null;

  const minEndDate = formData.dueDateStart
      ? new Date(new Date(formData.dueDateStart).getTime() + 86400000).toISOString().split('T')[0]
      : new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return (
      <>
        <header className="navbar">
          <img src={c2tredsLogo} alt="c2treds" />
        </header>

        <div className="page-wrapper">
          <div className="invoice-generator">

            {/* ── Header ── */}
            <div className="card-header">
              <h1>Invoice Generator</h1>
              <p>Generate and download invoices as a ZIP archive</p>
            </div>

            {/* ── Body ── */}
            <div className="card-body">

              {error && (
                  <div className="error-banner">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
              )}

              {/* ── Buyer Multi-Select ── */}
              <div className="form-group">
              <span className="form-label">
                Buyers
                {selectedBuyers.length > 0 && (
                    <span className="badge">{selectedBuyers.length} selected</span>
                )}
              </span>

                <div className="buyer-search-wrapper">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                      type="text"
                      placeholder="Search buyers…"
                      value={buyerSearch}
                      onChange={e => setBuyerSearch(e.target.value)}
                      className="buyer-search-input"
                  />
                </div>

                <div className="buyer-list">
                  {filteredBuyers.length === 0 ? (
                      <div className="buyer-empty">No buyers found</div>
                  ) : (
                      <>
                        <label className="buyer-item select-all-item">
                          <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={handleSelectAll}
                          />
                          <span className="buyer-label">Select All ({filteredBuyers.length})</span>
                        </label>
                        {filteredBuyers.map(buyer => (
                            <label key={buyer.buyer_name} className="buyer-item">
                              <input
                                  type="checkbox"
                                  checked={selectedBuyers.includes(buyer.buyer_name)}
                                  onChange={() => handleBuyerToggle(buyer.buyer_name)}
                              />
                              <span className="buyer-label">{buyer.buyer_name}</span>
                            </label>
                        ))}
                      </>
                  )}
                </div>
              </div>

              {/* ── Invoice Type + Product Type ── */}
              <div className="form-row">
                <div className="form-group">
                  <span className="form-label">Invoice Type</span>
                  <div className="select-wrapper">
                    <select
                        name="invoiceType"
                        value={formData.invoiceType}
                        onChange={handleInputChange}
                    >
                      <option value="">Select</option>
                      <option value="C2FO">C2FO</option>
                      <option value="ERP">ERP</option>
                      <option value="Manual Upload">Manual Upload</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <span className="form-label">Product Type</span>
                  <div className="select-wrapper">
                    <select
                        name="productType"
                        value={formData.productType}
                        onChange={handleInputChange}
                    >
                      <option value="">Select</option>
                      <option value="RFDDueDate">RFDDueDate</option>
                      <option value="BIFactoring">BIFactoring</option>
                      <option value="Normal">Normal</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Due Date Range ── */}
              <div className="form-group">
              <span className="form-label">
                Due date range
                <span className="label-hint">(optional — leave blank to auto-generate)</span>
                {formData.dueDateStart && formData.dueDateEnd && (
                    <span className="badge">
                    {new Date(formData.dueDateStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {' – '}
                      {new Date(formData.dueDateEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </span>

                <div className="date-range-box">
                  {/* Start Date */}
                  <div className="date-field-half">
                    <span className="date-sub-label">From</span>
                    <div className="date-input-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="date-icon">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <input
                          type="date"
                          name="dueDateStart"
                          value={formData.dueDateStart}
                          onChange={handleInputChange}
                          min={tomorrow}
                          className="date-input-half"
                      />
                    </div>
                  </div>

                  <span className="date-range-arrow">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>

                  {/* End Date */}
                  <div className="date-field-half">
                    <span className="date-sub-label">To</span>
                    <div className="date-input-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="date-icon">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <input
                          type="date"
                          name="dueDateEnd"
                          value={formData.dueDateEnd}
                          onChange={handleInputChange}
                          min={minEndDate}
                          className="date-input-half"
                      />
                    </div>
                  </div>

                  {/* Clear Button */}
                  {(formData.dueDateStart || formData.dueDateEnd) && (
                      <button
                          className="clear-range-btn"
                          onClick={() => setFormData(prev => ({ ...prev, dueDateStart: '', dueDateEnd: '' }))}
                          title="Clear dates"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                  )}
                </div>

                {/* Distribution hint */}
                {formData.dueDateStart && formData.dueDateEnd && dueDateSpanDays !== null && (
                    <div className="date-dist-hint">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>
                    {formData.numInvoices} invoice{formData.numInvoices > 1 ? 's' : ''} will get due dates evenly distributed across a{' '}
                        <strong>{dueDateSpanDays}-day span</strong>
                        {formData.numInvoices > 1 && (
                            <> — each invoice gets a unique due date</>
                        )}
                  </span>
                    </div>
                )}

                {/* Only one date filled warning */}
                {(formData.dueDateStart && !formData.dueDateEnd) && (
                    <div className="date-dist-hint date-dist-warn">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>Please also select an end date to complete the range</span>
                    </div>
                )}
                {(!formData.dueDateStart && formData.dueDateEnd) && (
                    <div className="date-dist-hint date-dist-warn">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>Please also select a start date to complete the range</span>
                    </div>
                )}
              </div>

              {/* ── Number of Invoices ── */}
              <div className="form-group">
                <span className="form-label">Number of Invoices per Buyer</span>
                <input
                    type="number"
                    name="numInvoices"
                    min="1"
                    max="100"
                    value={formData.numInvoices}
                    onChange={handleInputChange}
                />
              </div>
            </div>

            {/* ── Footer / CTA ── */}
            <div className="card-footer">
              <button
                  className="generate-btn"
                  onClick={generateCSV}
                  disabled={!isReady}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {isReady
                    ? `Download ${selectedBuyers.length === 1 ? 'CSV' : 'ZIP'} · ${selectedBuyers.length} ${selectedBuyers.length === 1 ? 'Buyer' : 'Buyers'} · ${formData.numInvoices} Invoice${formData.numInvoices > 1 ? 's' : ''} each`
                    : 'Complete all fields to generate'
                }
              </button>
            </div>

          </div>
        </div>
      </>
  );
};

export default InvoiceGenerator;
