const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { generatePDF } = require("./pdfGenerator");
const path = require("path");
const { queryDatabase } = require('./db');
const config = require('./config');
const { formatDate, updateDateToFirst } = require('./utils');
const app = express();
// Email Configuration
const transporter = nodemailer.createTransport({
    service: config.email.service,
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});




// Fetch data from SQL Server (example query)
const fetchDataFromDB = async (startDate,endDate) => {
    console.log("Start date and end date-----",startDate,endDate);
    
    const query = `SELECT ISNULL (TOTAL_CLIENT.NO_OF_CLIENT, 0)
           AS TOTAL_INVESTOR,
       ISNULL (TOTAL_SIP_CLIENT.NO_OF_SIP_CLIENT, 0)
           AS TOTAL_SIP_INVESTOR,
       ISNULL (TOTAL_ADDED.NEW_ADDED_INVESTOR, 0)
           AS NEW_ADDED_INVESTOR,
       ISNULL (TOTAL_ADDED_SIP.NEW_ADDED_SIP_INVESTOR, 0)
           AS NEW_ADDED_SIP_INVESTOR,
       ISNULL (CLIENT_FULL_SURRENDER.NO_OF_FULL_SURRENDER_CLIENT, 0)
           AS NO_OF_FULL_SURRENDER_INVESTOR,
       ISNULL (SIP_CLIENT_FULL_SURRENDER.NO_OF_FULL_SURRENDER_SIP_CLIENT, 0)
           AS NO_OF_FULL_SURRENDER_SIP_INVESTOR,
       ISNULL (TOTAL_SELL.TOTAL_SELL_AMOUNT, 0)
           AS TOTAL_SELL_AMOUNT,
       ISNULL (TOTAL_SURRENDER.TOTAL_SURRENDER_AMOUNT, 0)
           AS TOTAL_SURRENDER_AMOUNT
  FROM (SELECT SUM (
                   CASE
                       WHEN IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1 THEN 1
                       ELSE 0
                   END)
                   AS NO_OF_SIP_CLIENT
          FROM IS_INVESTOR_UNIT_APP,
               IS_INVESTOR_DETAILS,
               IS_INVESTOR_UNIT_STOCK,
               IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_DETAILS.BUSINESS_DATE <= '${endDate}'
               AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID =
                   IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
               AND ISNULL (IS_INVESTOR_UNIT_STOCK.REMAINING_UNITS, 0) > 0
               AND IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_STOCK_ID =
                   (SELECT MAX (MUSID.INVESTOR_UNIT_STOCK_ID)
                      FROM IS_INVESTOR_UNIT_STOCK  MUSID,
                           IS_INVESTOR_UNIT_APP    UA
                     WHERE     MUSID.INVESTOR_UNIT_APP_ID =
                               UA.INVESTOR_UNIT_APP_ID
                           AND UA.INVESTOR_ACCOUNT_ID =
                               IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
                           AND MUSID.BUSINESS_DATE <= '${endDate}'))
       TOTAL_SIP_CLIENT,
       (SELECT COUNT (DISTINCT IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID)
                   AS NO_OF_CLIENT
          FROM IS_INVESTOR_UNIT_APP,
               IS_INVESTOR_DETAILS,
               IS_INVESTOR_UNIT_STOCK,
               IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_DETAILS.BUSINESS_DATE <='${endDate}'
               AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID =
                   IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
               AND ISNULL (IS_INVESTOR_UNIT_STOCK.REMAINING_UNITS, 0) > 0
               AND IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_STOCK_ID =
                   (SELECT MAX (MUSID.INVESTOR_UNIT_STOCK_ID)
                      FROM IS_INVESTOR_UNIT_STOCK  MUSID,
                           IS_INVESTOR_UNIT_APP    UA
                     WHERE     MUSID.INVESTOR_UNIT_APP_ID =
                               UA.INVESTOR_UNIT_APP_ID
                           AND UA.INVESTOR_ACCOUNT_ID =
                               IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
                           AND MUSID.BUSINESS_DATE <= '${endDate}'))
       TOTAL_CLIENT,
       (SELECT COUNT (DISTINCT IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID)
                   AS NEW_ADDED_INVESTOR
          FROM IS_INVESTOR_UNIT_APP, IS_INVESTOR_DETAILS, IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_DETAILS.BUSINESS_DATE BETWEEN '${startDate}'
                                                         AND '${endDate}'
               AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Sell') TOTAL_ADDED,
       (SELECT COUNT (DISTINCT IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID)
                   AS NEW_ADDED_SIP_INVESTOR
          FROM IS_INVESTOR_UNIT_APP, IS_INVESTOR_DETAILS, IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_DETAILS.BUSINESS_DATE BETWEEN '${startDate}'
               AND '${endDate}'
               AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Sell')
       TOTAL_ADDED_SIP,
       (SELECT COUNT (DISTINCT IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID)
                   AS NO_OF_FULL_SURRENDER_CLIENT
          FROM IS_INVESTOR_UNIT_APP,
               IS_INVESTOR_DETAILS,
               IS_INVESTOR_UNIT_STOCK,
               IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE BETWEEN '${startDate}'
               AND '${endDate}'
               AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID =
                   IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
               AND ISNULL (IS_INVESTOR_UNIT_STOCK.REMAINING_UNITS, 0) = 0
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Surr')
       CLIENT_FULL_SURRENDER,
       (SELECT COUNT (DISTINCT IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID)
                   AS NO_OF_FULL_SURRENDER_SIP_CLIENT
          FROM IS_INVESTOR_UNIT_APP,
               IS_INVESTOR_DETAILS,
               IS_INVESTOR_UNIT_STOCK,
               IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE BETWEEN '${startDate}'
               AND '${endDate}'
               AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID =
                   IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
               AND IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1
               AND ISNULL (IS_INVESTOR_UNIT_STOCK.REMAINING_UNITS, 0) = 0
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Surr')
       SIP_CLIENT_FULL_SURRENDER,
       (SELECT SUM (IS_INVESTOR_UNIT_APP.TOTAL_AMOUNT)
                   AS TOTAL_SELL_AMOUNT
          FROM IS_INVESTOR_UNIT_APP,
               IS_INVESTOR_DETAILS,
               IS_INVESTOR_UNIT_STOCK,
               IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_UNIT_APP.BUSINESS_DATE BETWEEN '${startDate}'
               AND '${endDate}'
               AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
               AND IS_INVESTOR_UNIT_APP.HONOR_DISHONOR_CANCEL = 'h'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID =
                   IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Sell') TOTAL_SELL,
       (SELECT SUM (IS_INVESTOR_UNIT_APP.TOTAL_AMOUNT)
                   AS TOTAL_SURRENDER_AMOUNT
          FROM IS_INVESTOR_UNIT_APP,
               IS_INVESTOR_DETAILS,
               IS_INVESTOR_UNIT_STOCK,
               IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_UNIT_APP.BUSINESS_DATE BETWEEN '${startDate}'
               AND '${endDate}'
               AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID =
                   IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Surr')
               TOTAL_SURRENDER
 WHERE 1 = 1`;
    return await queryDatabase(query);
};
const fetchBusinessDate=async ()=>{
    const query=`SELECT TOP 1
      BUSINESS_DATE
FROM L_BUSINESS_DATE
WHERE BUSINESS_DATE < DATEADD(DAY, -1,CAST(GETDATE() AS DATE)) order by BUSINESS_DATE desc`

return await queryDatabase(query);

}

// Schedule Email Sending with PDF Attachment
cron.schedule('26 12 * * *', async () => {
    const outputPath = path.join(__dirname, "output.pdf");

    try {
        // Generate the PDF
        await generatePDF(outputPath,data);
        console.log('PDF generated successfully');

        // Send the Email with the PDF as an attachment
        await transporter.sendMail({
            from: `"Your App" <${config.email.user}>`,
            to: config.email.tousermail,
            subject: 'Scheduled Email with PDF',
            text: 'This is an automated email with the generated PDF attached.',
            attachments: [
                {
                    filename: 'table.pdf',
                    path: outputPath,
                },
            ],
        });

        console.log('Email sent successfully with PDF attachment');
    } catch (error) {
        console.error('Error sending email with PDF:', error.message);
    }
});

// Endpoint to Generate and Download PDF
app.get("/generate-pdf", async (req, res) => {
    const outputPath = path.join(__dirname, "output.pdf");

    try {
        await generatePDF(outputPath, data);
        res.download(outputPath, "table.pdf", (err) => {
            if (err) {
                console.error("Error during file download:", err?.message);
                res.status(500).send("Failed to generate PDF");
            }
        });
    } catch (error) {
        console.error("Error generating PDF:", error?.message);
        res.status(500).send("Error generating PDF");
    }
});
app.get('/fetchValues',async(req,res)=>{
    try{
        const businessDateEnd = await fetchBusinessDate();
     
         const endDate=formatDate(businessDateEnd[0].BUSINESS_DATE);

        const startDate=updateDateToFirst(endDate);

        
        const data = await fetchDataFromDB(startDate,endDate);
        
        res.status(200).json({
            msg:"Hitted successfully",
            data
        })
    }catch(error){
        res.status(500).send("Something went error");
    }
})
app.get('/getBusinessDate',async(req,res)=>{
    try{
        const data = await fetchBusinessDate();
        return data[0];
    }catch(error){
        res.status(500).send("Something went error");
    }
})

app.listen(8000, () => {
    console.log('Server running on port 8000');
});
