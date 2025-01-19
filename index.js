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
// const transporter = nodemailer.createTransport({
//     service: config.email.service,
//     auth: {
//         user: config.email.user,
//         pass: config.email.pass,
//     },
// });

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', // Microsoft SMTP server
    port: 587, // Port for STARTTLS
    secure: false, // Secure false for STARTTLS
    auth: {
        user: 'Hrithik@shanta-aml.com', // Your email address
        pass: 'Destroyer2712#', // Your email password or app password
    },
    tls: {
        ciphers: 'SSLv3', // Optional: Ensures secure connection
    },
});


// Fetch data from SQL Server (example query)
const fetchDataFromDB = async (startDate,endDate) => {
    const query=`
    SELECT ISNULL (TOTAL_CLIENT.NO_OF_CLIENT, 0)
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
       (Select Count(Distinct IID.PORTFOLIO_CODE) AS NEW_ADDED_INVESTOR
from IS_INVESTOR_ACCOUNT IIA
INNER JOIN IS_INVESTOR_DETAILS IID
ON IIA.INVESTOR_DETAILS_ID = IID.INVESTOR_DETAILS_ID
INNER JOIN IS_INVESTOR_UNIT_APP IUA
ON IIA.investor_account_id = IUA.investor_account_id
WHERE IIA.INVESTOR_DETAILS_ID IN (
SELECT distinct [INVESTOR_DETAILS_ID]  
  FROM [uslcamsshanta].[dbo].[IS_INVESTOR_ACCOUNT] 
  where BUSINESS_DATE between '${startDate}' and    '${endDate}'
  and  INVESTOR_DETAILS_ID not in (select  INVESTOR_DETAILS_ID from [uslcamsshanta].[dbo].[IS_INVESTOR_ACCOUNT] 
  where BUSINESS_DATE < '2024-12-01'))
  AND IIA.BUSINESS_DATE between '${startDate}' and    '${endDate}'
  AND IUA.MSG_STATUS = 'approved') TOTAL_ADDED,
       (SELECT Count(distinct IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID) AS NEW_ADDED_SIP_INVESTOR
          FROM IS_INVESTOR_UNIT_APP, IS_INVESTOR_DETAILS, IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_ACCOUNT.BUSINESS_DATE between '${startDate}' and    '${endDate}'
               AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
               AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID =
                   IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
               AND IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1
)
       TOTAL_ADDED_SIP,
       (SELECT COUNT (DISTINCT IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID)
                   AS NO_OF_FULL_SURRENDER_CLIENT
          FROM IS_INVESTOR_UNIT_APP,
               IS_INVESTOR_DETAILS,
               IS_INVESTOR_UNIT_STOCK,
               IS_INVESTOR_ACCOUNT
         WHERE     IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                   IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
               AND IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE between '${startDate}' and    '${endDate}'
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
               AND IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE between '${startDate}' and    '${endDate}'
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
          FROM IS_INVESTOR_UNIT_APP
         WHERE IS_INVESTOR_UNIT_APP.BUSINESS_DATE between '${startDate}' and    '${endDate}'
               AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
               AND IS_INVESTOR_UNIT_APP.HONOR_DISHONOR_CANCEL = 'h'
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Sell') TOTAL_SELL,
       (SELECT SUM (IS_INVESTOR_UNIT_APP.TOTAL_AMOUNT)
                   AS TOTAL_SURRENDER_AMOUNT
          FROM IS_INVESTOR_UNIT_APP
         WHERE  IS_INVESTOR_UNIT_APP.BUSINESS_DATE  between '${startDate}' and    '${endDate}'
               AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
               AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Surr')
               TOTAL_SURRENDER
 WHERE 1 = 1
`     

    return await queryDatabase(query);
};

const dempgraphicReport=async()=>{
    const query=`SELECT DISTINCT 
    ID.INVESTOR_DETAILS_ID AS INVESTOR_DETAILS_ID,
    IA.INVESTOR_ACCOUNT_ID,
    ID.INVESTOR_NAME,
    ID.PORTFOLIO_CODE,
    O.OCCUPATION,
    IA.PORTFOLIO_ID,
    LP.PORTFOLIO_NAME AS FUND_NAME,
	IUA.INVESTOR_UNIT_APP_ID,
    DATEDIFF(YEAR, ID.DOB, GETDATE()) -
        CASE 
            WHEN DATEADD(YEAR, DATEDIFF(YEAR, ID.DOB, GETDATE()), ID.DOB) > GETDATE() THEN 1 
            ELSE 0 
        END AS AGE,
    ID.GENDER,
    ID.MAILING_ADDRESS,
    FT.FREE_UNITS * PD.SELL_PRICE AS CURRENT_INVESTMENT,
    DATEDIFF(YEAR, IUA.BUSINESS_DATE, GETDATE()) AS Years_From_Business_Date,
    CASE 
        WHEN IA.INVESTMENT_TYPE_ID = 1 THEN 'SIP'
        WHEN IA.INVESTMENT_TYPE_ID = 2 THEN 'NON SIP'
    END AS FUND_TYPE,
    (
        SELECT COUNT(*) 
        FROM [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_APP] 
        WHERE [SELL_SURR_FLAG] = 'surr' 
            AND INVESTOR_ACCOUNT_ID = IA.INVESTOR_ACCOUNT_ID
    ) AS Surr_Count,
    (
        SELECT SUM(TOTAL_AMOUNT)
        FROM [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_APP]
        WHERE 
            SELL_SURR_FLAG != 'surr' 
            AND INVESTOR_ACCOUNT_ID = IA.INVESTOR_ACCOUNT_ID
    ) AS Total_Amount
FROM 
    IS_INVESTOR_UNIT_APP IUA
INNER JOIN IS_INVESTOR_ACCOUNT IA 
    ON IUA.INVESTOR_ACCOUNT_ID = IA.INVESTOR_ACCOUNT_ID
INNER JOIN IS_INVESTOR_DETAILS ID 
    ON IA.INVESTOR_DETAILS_ID = ID.INVESTOR_DETAILS_ID
LEFT JOIN GS_OCCUPATION O 
    ON ID.OCCUPATION_ID = O.OCCUPATION_ID
INNER JOIN IS_INVESTOR_UNIT_STOCK IUS 
    ON IUA.INVESTOR_UNIT_APP_ID = IUS.INVESTOR_UNIT_APP_ID
LEFT JOIN LS_PORTFOLIO LP 
    ON IA.PORTFOLIO_ID = LP.PORTFOLIO_ID
INNER JOIN (
    SELECT 
        [PORTFOLIO_ID],
        [SELL_PRICE],
        [SURRENDER_PRICE_LESS],
        [NAV_DATE]
    FROM [uslcamsshanta].[dbo].[A_NAV]
    WHERE [NAV_DATE] = (
        SELECT MAX([NAV_DATE])
        FROM [uslcamsshanta].[dbo].[A_NAV] AS subquery
        WHERE subquery.[PORTFOLIO_ID] = [A_NAV].[PORTFOLIO_ID]
    )
) PD
ON IA.PORTFOLIO_ID = PD.PORTFOLIO_ID
INNER JOIN (
SELECT 
    IUS.INVESTOR_UNIT_STOCK_ID,
    IUS.INVESTOR_UNIT_APP_ID,
    IUS.PORTFOLIO_ID,
    IUS.FREE_UNITS
FROM 
    [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_STOCK] IUS
WHERE 
    IUS.FREE_UNITS > 0
    AND IUS.BUSINESS_DATE = (
        SELECT 
            MAX(BUSINESS_DATE)
        FROM 
            [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_STOCK] AS SubIUS
        WHERE 
            SubIUS.INVESTOR_UNIT_APP_ID = IUS.INVESTOR_UNIT_APP_ID
    )
    AND IUS.INVESTOR_UNIT_APP_ID IN (
        SELECT 
            A.INVESTOR_UNIT_APP_ID
        FROM 
            [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_APP] A
        INNER JOIN (
            SELECT 
                INVESTOR_ACCOUNT_ID,
                MAX(BUSINESS_DATE) AS Latest_Business_Date
            FROM 
                [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_APP]
            GROUP BY 
                INVESTOR_ACCOUNT_ID
        ) B
        ON 
            A.INVESTOR_ACCOUNT_ID = B.INVESTOR_ACCOUNT_ID
            AND A.BUSINESS_DATE = B.Latest_Business_Date
    )
) FT
ON FT.INVESTOR_UNIT_APP_ID = IUA.INVESTOR_UNIT_APP_ID 
    AND IA.PORTFOLIO_ID = FT.PORTFOLIO_ID
WHERE 
    ID.BUSINESS_DATE <= '2024-12-31'
    AND ID.MSG_STATUS = 'approved' 
    AND ISNULL(IUS.REMAINING_UNITS, 0) > 0
    AND IUS.INVESTOR_UNIT_STOCK_ID = (
        SELECT MAX(MUSID.INVESTOR_UNIT_STOCK_ID)
        FROM IS_INVESTOR_UNIT_STOCK MUSID
        INNER JOIN IS_INVESTOR_UNIT_APP UA 
            ON MUSID.INVESTOR_UNIT_APP_ID = UA.INVESTOR_UNIT_APP_ID
        WHERE 
            UA.INVESTOR_ACCOUNT_ID = IA.INVESTOR_ACCOUNT_ID
            AND MUSID.BUSINESS_DATE <= '2024-12-31'
    )
`
return await queryDatabase(query);

}
const fetchBusinessDate=async ()=>{
    const query=`SELECT TOP 1 BUSINESS_DATE
FROM L_BUSINESS_DATE
WHERE BUSINESS_DATE < CAST(GETDATE() AS DATE)
ORDER BY BUSINESS_DATE DESC;`

return await queryDatabase(query);

}
const sendEmail = async (outputPath) => {
    const mailOptions = {
        from: 'Hrithik@shanta-aml.com', // MUST match the authenticated email
    //    to: 'Hrithik@shanta-aml.com', // Recipient's email (same as sender for testing)
        // to: 'kazi.monir@shanta-aml.com', // Recipient's email (same as sender for testing)
        to: 'tanbina@shanta-aml.com', // Add CC recipients here
        // cc:'rahim@shantasecurities.com',
        subject: 'Sales & Investor Summary Report',
        text: 'This is automated mail which consist of Sales & Investor Summary Report',
        attachments: [
                             {
                                filename: 'Report.pdf',
                                path: outputPath,
                             },
                      ]    
    }

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
    } catch (error) {
        console.error('Error sending email:', error.message);
    }
};
// Schedule Email Sending with PDF Attachment
cron.schedule('45 12 * * *', async () => {
    const outputPath = path.join(__dirname, "output.pdf");

    try {
        // Generate the PDF
        const data=await getMainData();
        
        await generatePDF(outputPath,data);
        console.log('PDF generated successfully');

        // Send the Email with the PDF as an attachment

        // const mailOptions = {
        //     from: '"Shanta Asset Management Limited "<${config.email.user}>', // Sender address
        //     to: 'Hrithik@shanta-aml.com', // Recipient address
        //     subject: 'Scheduled Email with PDF',
        //     text: 'This is an automated email with the generated PDF attached.',
        //     attachments: [
        //                 {
        //                     filename: 'table.pdf',
        //                     path: outputPath,
        //                  },
        //              ]
        // };
        // transporter.sendMail(mailOptions, (error, info) => {
        //     if (error) {
        //         return console.log('Error:', error);
        //     }
        //     console.log('Message sent:', info.response);
        // });
        sendEmail(outputPath);
        
        // await transporter.sendMail({
        //     from: `"Your App" <${config.email.user}>`,
        //     to: config.email.tousermail,
        //     subject: 'Scheduled Email with PDF',
        //     text: 'This is an automated email with the generated PDF attached.',
        //     attachments: [
        //         {
        //             filename: 'table.pdf',
        //             path: outputPath,
        //         },
        //     ],
        // });

    } catch (error) {
        console.error('Error sending email with PDF:', error.message);
    }
});

// Endpoint to Generate and Download PDF
app.get("/generate-pdf", async (req, res) => {
    const outputPath = path.join(__dirname, "output.pdf");

    try {
        const data=await getMainData()
        await generatePDF(outputPath, data);
        res.download(outputPath, "Report.pdf", (err) => {
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
const getMainData=async()=>{
    const businessDateEnd = await fetchBusinessDate();
     
    const endDate=formatDate(businessDateEnd[0].BUSINESS_DATE);

   const startDate=updateDateToFirst(endDate);

   
   const data = await fetchDataFromDB(startDate,endDate);
//   const data = await fetchDataFromDB('2024-12-01','2024-12-31');
   
  return data
}
// app.get('/fetchValues',async(req,res)=>{
//     try{
//         const businessDateEnd = await fetchBusinessDate();
     
//          const endDate=formatDate(businessDateEnd[0].BUSINESS_DATE);

//         const startDate=updateDateToFirst(endDate);

        
//         // const data = await fetchDataFromDB(startDate,endDate);
//        const data = await fetchDataFromDB('2024-11-01','2024-11-30');

//         res.status(200).json({
//             msg:"Hitted successfully",
//             data
//         })
//     }catch(error){
//         res.status(500).send("Something went error");
//     }
// })
app.get('/getDemographicReport',async(req,res)=>{
    const outputPath = path.join(__dirname, "output.pdf");

    try {
        const data=await dempgraphicReport()
        await generatePDF(outputPath, data);
        res.download(outputPath, "Report.pdf", (err) => {
            if (err) {
                console.error("Error during file download:", err?.message);
                res.status(500).send("Failed to generate PDF");
            }
        });
    } catch (error) {
        console.error("Error generating PDF:", error?.message);
        res.status(500).send("Error generating PDF");
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
