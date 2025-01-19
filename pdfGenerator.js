const { PDFDocument, rgb } = require("pdf-lib");

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
          "Total SIP Client",
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


module.exports = { generatePDF };
