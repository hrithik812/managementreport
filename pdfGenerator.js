const { PDFDocument, rgb } = require("pdf-lib");
const xlsx = require('xlsx');

const fs = require("fs");
const path=require('path');
const drawTable = (doc, headers, data, startX, startY, rowHeight) => {
  let currentY = startY;

  const pageHeight = doc.page.height;
  const bottomMargin = 50;

  doc.fontSize(12).font("Helvetica-Bold");
  headers.forEach((header, i) => {
    doc.text(header, startX + i * 100, currentY, { width: 100, align: "center" });
  });

  currentY += rowHeight;
  doc.fontSize(10).font("Helvetica");

  data.forEach((row) => {
    if (currentY + rowHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = 50;

      doc.fontSize(12).font("Helvetica-Bold");
      headers.forEach((header, i) => {
        doc.text(header, startX + i * 100, currentY, { width: 100, align: "center" });
      });

      currentY += rowHeight;
      doc.fontSize(10).font("Helvetica");
    }

    headers.forEach((header, i) => {
      doc.text(row[header], startX + i * 100, currentY, { width: 100, align: "center" });
    });

    currentY += rowHeight;
  });
};

function getFormattedDate() {
  const date = new Date(); // Use the current date
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() starts from 0
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

async function generatePDF(outputPath,data) {

    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);

    // Set font sizes and colors
    const fontSize = 12;
    const greenFill = rgb(0.5569, 0.5412, 0.1216);
    const blackFill = rgb(0, 0, 0);

    // Draw Header Section
    page.drawRectangle({
        x: 50,
        y: 350,
        width: 500,
        height: 40,
        color: greenFill,
    });
    page.drawText("Daily Sales & Investor Report", {
        x: 200,
        y: 370,
        size: fontSize + 2,
        color: rgb(1, 1, 1),
    });

    page.drawRectangle({
        x: 50,
        y: 310,
        width: 500,
        height: 30,
        color: greenFill,
    });
    page.drawText(getFormattedDate(), {
        x: 240,
        y: 320,
        size: fontSize,
        color: rgb(1, 1, 1),
    });

    // Draw Table Headers
    const tableHeaders = ["Item", "Number/Sale", "Added", "Surrendered", "Net"];
    let startX = 60;
    let startY = 290;

    tableHeaders.forEach((header, index) => {
        page.drawText(header, { x: startX + index * 100, y: startY, size: fontSize });
    });

    // Draw Table Rows
    const rowData = [
      [
          "Total Client",
          data[0].TOTAL_INVESTOR,
          data[0].NEW_ADDED_INVESTOR,
          data[0].NO_OF_FULL_SURRENDER_INVESTOR,
          data[0].NEW_ADDED_INVESTOR - data[0].NO_OF_FULL_SURRENDER_INVESTOR
      ],
      [
          "Total SIP",
          data[0].TOTAL_SIP_INVESTOR,
          data[0].NEW_ADDED_SIP_INVESTOR,
          data[0].NO_OF_FULL_SURRENDER_SIP_INVESTOR,
          data[0].NEW_ADDED_SIP_INVESTOR - data[0].NO_OF_FULL_SURRENDER_SIP_INVESTOR
      ],
      [
          "Sale",
          data[0].TOTAL_SELL_AMOUNT.toLocaleString("en-IN"), // Format with commas
          "-",
          data[0].TOTAL_SURRENDER_AMOUNT.toLocaleString("en-IN"), // Format with commas
          (data[0].TOTAL_SELL_AMOUNT - data[0].TOTAL_SURRENDER_AMOUNT).toLocaleString("en-IN") // Format result with commas
      ]
  ];
  
    
    startY -= 20;
    rowData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            page.drawText(cell.toString(), {
                x: startX + colIndex * 100,
                y: startY - rowIndex * 20,
                size: fontSize,
            });
        });
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
}
async function generateSurrenderCSV(outputPath, data) {
    // Define the CSV headers
    const headers = [
      "Reg", "Name", "Name of Fund", "First Date of Investment",
      "Duration in Month", "Surrender Amount", "Unit Held", "RM"
  ];

  // Create an array to hold the Excel rows, starting with the headers
  const rows = [headers];

  // Add data rows to the Excel sheet
  data?.forEach((row) => {
      const values = [
          row.INVESTOR_REG_NO,
          row.INVESTOR_NAME,
          row.NAME_OF_FUND,
          row.FIRST_DATE_OF_INVESTMENT,
          row.DURATION_IN_MONTHS,
          row.SURRENDER_AMOUNT,
          row.UNIT_HELD,
          row.RM_NAME
      ];
      rows.push(values); // Add each row to the rows array
  });

  // Create a new workbook
  const workbook = xlsx.utils.book_new();

  // Convert the rows array into a worksheet
  const worksheet = xlsx.utils.aoa_to_sheet(rows);

  // Append the worksheet to the workbook
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Surrender Data');

  // Write the workbook to the specified output path
  xlsx.writeFile(workbook, outputPath);

  console.log(`Excel file saved to ${outputPath}`);
}
async function generateDemographicCSV(outputPath, data) {
   
  
  const headers = [
    "INVESTOR_NAME", "PORTFOLIO_CODE", "OCCUPATION", "INVESTOR_REG_NO",
    "FUND_NAME", "AGE", "GENDER", "MAILING_ADDRESS", "TOTAL_INVESTMENT",
    "CURRENT_INVESTMENT", "MONTHS_OF_INVESTMENT", "FUND_TYPE", "SURR_FREQUENCY"
];

// Create an array to hold rows for the Excel file, starting with headers
const excelRows = [headers];

// Add data rows to the Excel file
data?.forEach((row) => {
    const values = [
        row.INVESTOR_NAME,
        row.PORTFOLIO_CODE,
        row.OCCUPATION,
        row.INVESTOR_REG_NO,
        row.FUND_NAME,
        row.AGE,
        row.GENDER,
        row.MAILING_ADDRESS,
        row.TOTAL_INVESTMENT,
        row.CURRENT_INVESTMENT,
        row.MONTHS_OF_INVESTMENT,
        row.FUND_TYPE,
        row.SURR_FREQUENCY,
    ];
    excelRows.push(values);
});

// Create a new workbook and add a worksheet
const workbook = xlsx.utils.book_new();
const worksheet = xlsx.utils.aoa_to_sheet(excelRows);

// Append the worksheet to the workbook
xlsx.utils.book_append_sheet(workbook, worksheet, 'Demographics');

// Write the workbook to the specified output path
xlsx.writeFile(workbook, outputPath);
console.log(`Excel file saved to ${outputPath}`);
}
async function generateSIPRankingPDF(outputPath, data) {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
    
  // Set font sizes and colors
  const fontSize = 10;
  const blackFill = rgb(0, 0, 0);
  const headerFill = rgb(0.8, 0.8, 0.8);

  // Draw Title Section
  page.drawText("SIP Ranking - December", {
      x: 200,
      y: 750,
      size: 14,
      color: blackFill,
  });

  // Define Table Headers
  const headers = ["Serial No","Name","Conversion", "Amount"];
  const headerX = [50, 100, 300, 400]; // Adjust column starting positions
  const columnWidths = [50, 200, 100, 100]; // Adjust column widths

  const startY = 720;

  // Draw Header Row
  headers.forEach((header, index) => {
      page.drawRectangle({
          x: headerX[index],
          y: startY,
          width: columnWidths[index],
          height: 20,
          color: headerFill,
      });
      page.drawText(header, {
          x: headerX[index] + 5,
          y: startY + 5,
          size: fontSize,
          color: blackFill,
      });
  });

  // Draw Table Rows
  const rowHeight = 20;
  let currentY = startY - rowHeight;

  data.forEach((row, rowIndex) => {
      const { NAME, CONVERSION, TOTAL_AMOUNT } = row;
      
      const rowData = [
        (rowIndex + 1).toString(), // Convert index to string
        NAME,
        CONVERSION.toString(), // Convert CONVERSION to string
        TOTAL_AMOUNT.toLocaleString("en-IN"), // Format TOTAL_AMOUNT with commas and convert to string
    ];

      rowData.forEach((cell, colIndex) => {
          page.drawText(cell, {
              x: headerX[colIndex] + 5,
              y: currentY + 5,
              size: fontSize,
              color: blackFill,
          });
      });

      currentY -= rowHeight;
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`PDF generated successfully at ${outputPath}`);
}
const fullSurrenderDetailsPDF = async (outputPath, data) => {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);

    // Append the worksheet to the workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, "Investors");

    // Write the Excel file
    xlsx.writeFile(workbook, outputPath);

    console.log(`Excel file '${outputPath}' has been created successfully!`);
};
const investorMobileEmailXlsx = async (outputPath, data) => {
    // Define column headers
    const headers = ["Client Name", "Portfolio Code", "Mobile", "Email"];

    // Prepare data for worksheet
    const worksheetData = [headers];

    data.forEach((row, rowIndex) => {
        worksheetData.push([
            row.CLIENT_NAME || 'N/A',
            row.PORTFOLIO_CODE || 'N/A',
            row.MOBILE || 'N/A',
            row.EMAIL || 'N/A',
        ]);
    });

    // Create a new workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(worksheetData);

    // Adjust column widths
    ws['!cols'] = [
        { wch: 30 }, // Client Name
        { wch: 20 }, // Portfolio Code
        { wch: 15 }, // Mobile
        { wch: 30 }, // Email
    ];

    // Append worksheet to workbook
 xlsx.utils.book_append_sheet(wb, ws, "Investor Details");

    // Write workbook to file
    xlsx.writeFile(wb, outputPath);

    console.log(`XLSX generated successfully at ${outputPath}`);
};

module.exports = { generatePDF,generateSurrenderCSV,generateDemographicCSV ,generateSIPRankingPDF,fullSurrenderDetailsPDF,investorMobileEmailXlsx};
