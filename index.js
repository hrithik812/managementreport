const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { generatePDF, generateSurrenderCSV,generateDemographicCSV,generateSIPRankingPDF,fullSurrenderDetailsPDF,investorMobileEmailXlsx} = require("./pdfGenerator");
const path = require("path");
const { queryDatabase } = require('./db');
const config = require('./config');
const { formatDate, updateDateToFirst } = require('./utils');
const app = express();

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

const cronTime = '53 17 * * *'; // This can come from environment variables or an API
const emailRecipient = 'Hrithik@shanta-aml.com'; // Can be passed dynamically
// Fetch data from SQL Server (example query)
const fetchDataFromDB = async (query) => {
 
    
    return await queryDatabase(query);
};
const fetchBusinessDate=async ()=>{
    const query=`SELECT TOP 1 BUSINESS_DATE
FROM L_BUSINESS_DATE
WHERE BUSINESS_DATE < CAST(GETDATE() AS DATE)
ORDER BY BUSINESS_DATE DESC;`

return await queryDatabase(query);

}
function dynamicCronScheduler(cronTime, dataFetcher, pdfGenerate, emailRecipient,outPath,fName,subject) {
    cron.schedule(cronTime, async () => {
         
        const outputPath = path.join(__dirname, outPath);
        
        try {
        
            // Fetch the data dynamically
            const data = await dataFetcher();
            console.log('Data fetched:', data);

            // Generate the PDF dynamically
            await pdfGenerate(outputPath, data);
            console.log('PDF generated successfully:', outputPath);

            // Send the email with the PDF as an attachment
            sendEmail(outputPath,fName,emailRecipient,subject);

            console.log('Email sent successfully!');
        } catch (error) {
            console.error('Error in cron job:', error.message);
        }
    });
}




const sendEmail = async (outputPath,filename,emailRecipient,subject) => {
    const mailOptions = {
        from: 'Hrithik@shanta-aml.com', // MUST match the authenticated email
    //    to: 'Hrithik@shanta-aml.com', // Recipient's email (same as sender for testing)
        // to: 'kazi.monir@shanta-aml.com', // Recipient's email (same as sender for testing)
        to: emailRecipient, // Add CC recipients here
        // cc:'rahim@shantasecurities.com',
        subject: subject,
        text: `This is automated mail which consist of ${subject} Report`,
        attachments: [
                             {
                                filename: filename,
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
cron.schedule('45 15 * * *', async () => {
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



const getMainData=async()=>{
    const businessDateEnd = await fetchBusinessDate();
     
    const endDate=formatDate(businessDateEnd[0].BUSINESS_DATE);

   const startDate=updateDateToFirst(endDate);

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
 where BUSINESS_DATE < '${startDate}'))
 AND IIA.BUSINESS_DATE between '${startDate}' and    '${endDate}'
 AND IUA.MSG_STATUS = 'approved') TOTAL_ADDED,
      (SELECT Count(Distinct IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID) AS NEW_ADDED_SIP_INVESTOR
         FROM IS_INVESTOR_UNIT_APP
		 INNER JOIN IS_INVESTOR_ACCOUNT ON
		 IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID =
                  IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
		 INNER JOIN IS_INVESTOR_DETAILS ON
		    	 IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID =
                  IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID
		 INNER JOIN (
    SELECT T1.INVESTOR_ACCOUNT_ID, T1.TRANSACTION_DETAILS_ID, T1.BUSINESS_DATE
    FROM [uslcamsshanta].[dbo].[IS_TRANSACTION_DETAILS] T1
    WHERE T1.TRANSACTION_DETAILS_ID = (
        SELECT TOP 1 T2.TRANSACTION_DETAILS_ID
        FROM [uslcamsshanta].[dbo].[IS_TRANSACTION_DETAILS] T2
        WHERE T1.INVESTOR_ACCOUNT_ID = T2.INVESTOR_ACCOUNT_ID
        ORDER BY T2.BUSINESS_DATE ASC, T2.TRANSACTION_DETAILS_ID ASC
    )
) FT 
    ON FT.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
              AND FT.BUSINESS_DATE between '${startDate}' and    '${endDate}'
              AND IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1
)
      TOTAL_ADDED_SIP,
      (WITH FilteredAccounts_ZeroUnits AS (
    SELECT INVESTOR_ACCOUNT_ID
    FROM IS_INVESTOR_UNIT_APP
    GROUP BY INVESTOR_ACCOUNT_ID
    HAVING 
        SUM(CASE WHEN SELL_SURR_FLAG = 'sell' THEN NO_OF_UNITS ELSE 0 END) - 
        SUM(CASE WHEN SELL_SURR_FLAG = 'surr' THEN NO_OF_UNITS ELSE 0 END) = 0
),
FilteredAccounts_PositiveUnits AS (
    -- Accounts where Net_Units > 0
    SELECT INVESTOR_ACCOUNT_ID
    FROM IS_INVESTOR_UNIT_APP
    GROUP BY INVESTOR_ACCOUNT_ID
    HAVING 
        SUM(CASE WHEN SELL_SURR_FLAG = 'sell' THEN NO_OF_UNITS ELSE 0 END) - 
        SUM(CASE WHEN SELL_SURR_FLAG = 'surr' THEN NO_OF_UNITS ELSE 0 END) > 0
),
ExcludedPortfolios AS (
    -- Portfolio codes to exclude
    SELECT DISTINCT IS_INVESTOR_DETAILS.PORTFOLIO_CODE
    FROM IS_INVESTOR_UNIT_APP
    JOIN IS_INVESTOR_ACCOUNT 
        ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
    JOIN IS_INVESTOR_DETAILS 
        ON IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID = IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
    JOIN IS_INVESTOR_UNIT_STOCK 
        ON IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID = IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
    WHERE IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE BETWEEN '${startDate}' AND '${endDate}'
        AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
        AND IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID IN (SELECT INVESTOR_ACCOUNT_ID FROM FilteredAccounts_PositiveUnits)
)

-- Main Query
SELECT COUNT(DISTINCT IS_INVESTOR_DETAILS.PORTFOLIO_CODE) AS NO_OF_FULL_SURRENDER_CLIENT
FROM IS_INVESTOR_UNIT_APP
JOIN IS_INVESTOR_ACCOUNT 
    ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
JOIN IS_INVESTOR_DETAILS 
    ON IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID = IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
JOIN IS_INVESTOR_UNIT_STOCK 
    ON IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID = IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
LEFT JOIN ExcludedPortfolios 
    ON IS_INVESTOR_DETAILS.PORTFOLIO_CODE = ExcludedPortfolios.PORTFOLIO_CODE
WHERE IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE BETWEEN '${startDate}' AND '${endDate}'
    AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
    AND IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID IN (SELECT INVESTOR_ACCOUNT_ID FROM FilteredAccounts_ZeroUnits)
    AND ExcludedPortfolios.PORTFOLIO_CODE IS NULL;  -- Replaces NOT IN
)
      CLIENT_FULL_SURRENDER,
      (SELECT 
        SUM(CASE WHEN sell_surr_flag IN ('sell', 'div') THEN NO_OF_UNITS ELSE 0 END) - 
        SUM(CASE WHEN sell_surr_flag = 'surr' THEN NO_OF_UNITS ELSE 0 END)
     FROM 
       IS_INVESTOR_UNIT_APP AS IU_SUB
     WHERE 
        IU_SUB.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
		AND IU_SUB.BUSINESS_DATE <= '${endDate}'
    ) AS Unit_Held
FROM IS_INVESTOR_UNIT_APP
JOIN IS_INVESTOR_ACCOUNT 
    ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
JOIN IS_INVESTOR_DETAILS 
    ON IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID = IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
JOIN IS_INVESTOR_UNIT_STOCK 
    ON IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID = IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID

WHERE IS_INVESTOR_UNIT_APP.BUSINESS_DATE BETWEEN '${startDate
}' AND '${endDate}'
AND IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1
) MainTable where Unit_Held=0
)
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
 const data = await fetchDataFromDB(query);
//   const data = await fetchDataFromDB('2024-12-01','2024-12-31');
   
  return data
}
const getSurrenderSIP=async()=>{
    const startDate='2024-12-01';
    const endDate='2024-12-31'
    const query=`
    SELECT 
    IA.INVESTOR_REG_NO,ID.INVESTOR_NAME,
    LS_PORTFOLIO.PORTFOLIO_NAME AS NAME_OF_FUND,IA.BUSINESS_DATE AS FIRST_DATE_OF_INVESTMENT,
	DATEDIFF(MONTH, IA.BUSINESS_DATE, '${startDate}') AS DURATION_IN_MONTHS,IU.TOTAL_AMOUNT AS SURRENDER_AMOUNT,IUS.REMAINING_UNITS AS UNIT_HELD,U.USER_NAME AS RM_NAME
FROM 
    [uslcamsshanta].[dbo].[IS_INVESTOR_ACCOUNT] IA
INNER JOIN 
    [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_APP] IU
    ON IA.INVESTOR_ACCOUNT_ID = IU.INVESTOR_ACCOUNT_ID
INNER JOIN LS_PORTFOLIO
    ON LS_PORTFOLIO.PORTFOLIO_ID=IA.PORTFOLIO_ID
INNER JOIN IS_INVESTOR_DETAILS ID
    ON ID.INVESTOR_DETAILS_ID=IA.INVESTOR_DETAILS_ID
INNER JOIN IS_INVESTOR_UNIT_STOCK IUS
    ON IUS.INVESTOR_UNIT_APP_ID=IU.INVESTOR_UNIT_APP_ID
INNER JOIN UP_IS_USER U
    ON U.EMPLOYEE_CODE=ID.EMPLOYEE_CODE
WHERE 
    IU.BUSINESS_DATE BETWEEN '${startDate}' AND '${endDate}'
    AND IU.SELL_SURR_FLAG = 'surr' And ia.INVESTMENT_TYPE_ID=1`
    const data = await fetchDataFromDB(query);
       
      return data
    
}
const demographicReport=async()=>{
    const query=`SELECT DISTINCT 
    ID.INVESTOR_NAME,
    ID.PORTFOLIO_CODE,
    O.OCCUPATION,
	IA.INVESTOR_REG_NO,
    LP.PORTFOLIO_NAME AS FUND_NAME,
    DATEDIFF(YEAR, ID.DOB, GETDATE()) -
        CASE 
            WHEN DATEADD(YEAR, DATEDIFF(YEAR, ID.DOB, GETDATE()), ID.DOB) > GETDATE() THEN 1 
            ELSE 0 
        END AS AGE,
    ID.GENDER,
    ID.MAILING_ADDRESS,

    (
        SELECT SUM(TOTAL_AMOUNT)
        FROM [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_APP]
        WHERE 
            SELL_SURR_FLAG != 'surr' 
            AND INVESTOR_ACCOUNT_ID = IA.INVESTOR_ACCOUNT_ID
    ) AS TOTAL_INVESTMENT,
    FT.FREE_UNITS * PD.SELL_PRICE AS CURRENT_INVESTMENT,
DATEDIFF(MONTH, IUA.BUSINESS_DATE, GETDATE()) AS MONTHS_OF_INVESTMENT,
CASE 
        WHEN IA.INVESTMENT_TYPE_ID = 1 THEN 'SIP'
        WHEN IA.INVESTMENT_TYPE_ID = 2 THEN 'NON SIP'
    END AS FUND_TYPE,
    (
        SELECT COUNT(*) 
        FROM [uslcamsshanta].[dbo].[IS_INVESTOR_UNIT_APP] 
        WHERE [SELL_SURR_FLAG] = 'surr' 
            AND INVESTOR_ACCOUNT_ID = IA.INVESTOR_ACCOUNT_ID
    ) AS SURR_FREQUENCY
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
LEFT JOIN (
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
LEFT JOIN (
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
	AND ID.INVESTOR_NAME IS NOT NULL
`
return await queryDatabase(query);

}
const rmWiseSip=async()=>{
    const startDate='2024-12-01';
    const endDate='2024-12-31'
    const query=`
   SELECT 
    UP_IS_USER.USER_NAME AS NAME,COUNT(IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID) AS CONVERSION,SUM(IS_INVESTOR_UNIT_APP.TOTAL_AMOUNT) AS TOTAL_AMOUNT
FROM 
    IS_INVESTOR_UNIT_APP
    INNER JOIN IS_INVESTOR_ACCOUNT 
        ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
    INNER JOIN IS_INVESTOR_DETAILS 
        ON IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID = IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
	LEFT JOIN UP_IS_USER ON IS_INVESTOR_DETAILS.AGENT_ID=UP_IS_USER.USER_ID
WHERE 
    IS_INVESTOR_ACCOUNT.BUSINESS_DATE BETWEEN '2024-12-01' AND '2024-12-31'
    AND IS_INVESTOR_UNIT_APP.MSG_STATUS = 'approved'
    AND IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1
    AND IS_INVESTOR_UNIT_APP.SELL_SURR_FLAG = 'Sell'
GROUP BY 
    IS_INVESTOR_DETAILS.EMPLOYEE_CODE,UP_IS_USER.USER_NAME`
    const data = await fetchDataFromDB(query);
       
      return data
    
}
const fullSurrenderDetails=async()=>{
    const startDate='2025-02-16';
    const endDate='2025-02-22'
    const query=`
SELECT DISTINCT 
    IS_INVESTOR_DETAILS.INVESTOR_NAME,IS_INVESTOR_DETAILS.PORTFOLIO_CODE,U.USER_NAME AS RM_NAME,
	    	IS_INVESTOR_DETAILS.MOBILE,
	IS_INVESTOR_DETAILS.EMAIL,
	P.PORTFOLIO_NAME AS FUND_NAME,
	CASE 
        WHEN IS_INVESTOR_ACCOUNT.INVESTMENT_TYPE_ID = 1 THEN 'SIP' 
        ELSE 'NON-SIP' 
    END AS INVESTMENT_TYPE,
	    FT.BUSINESS_DATE AS FIRST_DATE_OF_INVESTMENT,

	LATEST_TXN.TRANSACTION_AMOUNT AS SURRENDER_AMOUNT

	FROM IS_INVESTOR_UNIT_APP
JOIN IS_INVESTOR_ACCOUNT 
    ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
JOIN IS_INVESTOR_DETAILS 
    ON IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID = IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
JOIN IS_INVESTOR_UNIT_STOCK 
    ON IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID = IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
JOIN UP_IS_USER U
    ON U.USER_ID=IS_INVESTOR_DETAILS.AGENT_ID
JOIN LS_PORTFOLIO P
   ON P.PORTFOLIO_ID=IS_INVESTOR_ACCOUNT.PORTFOLIO_ID
JOIN (
    SELECT T1.INVESTOR_ACCOUNT_ID, T1.TRANSACTION_DETAILS_ID, T1.BUSINESS_DATE
    FROM [uslcamsshanta].[dbo].[IS_TRANSACTION_DETAILS] T1
    WHERE T1.TRANSACTION_DETAILS_ID = (
        SELECT TOP 1 T2.TRANSACTION_DETAILS_ID
        FROM [uslcamsshanta].[dbo].[IS_TRANSACTION_DETAILS] T2
        WHERE T1.INVESTOR_ACCOUNT_ID = T2.INVESTOR_ACCOUNT_ID
        ORDER BY T2.BUSINESS_DATE ASC, T2.TRANSACTION_DETAILS_ID ASC
    )
) FT 
    ON FT.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
LEFT JOIN (
    -- Subquery to fetch the latest transaction amount per investor
    SELECT INVESTOR_ACCOUNT_ID, TRANSACTION_AMOUNT
    FROM (
        SELECT INVESTOR_ACCOUNT_ID, TRANSACTION_AMOUNT,
               ROW_NUMBER() OVER (PARTITION BY INVESTOR_ACCOUNT_ID ORDER BY TRANSACTION_DETAILS_ID DESC) AS rn
        FROM [uslcamsshanta].[dbo].[IS_TRANSACTION_DETAILS]
    ) AS LatestTransaction
    WHERE rn = 1
) LATEST_TXN
    ON LATEST_TXN.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
JOIN (
    SELECT INVESTOR_ACCOUNT_ID
    FROM IS_INVESTOR_UNIT_APP
    GROUP BY INVESTOR_ACCOUNT_ID
    HAVING 
        SUM(CASE WHEN SELL_SURR_FLAG = 'sell' THEN NO_OF_UNITS ELSE 0 END) - 
        SUM(CASE WHEN SELL_SURR_FLAG = 'surr' THEN NO_OF_UNITS ELSE 0 END) = 0
) ZeroUnitsAccounts
    ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = ZeroUnitsAccounts.INVESTOR_ACCOUNT_ID
LEFT JOIN (
    SELECT DISTINCT IS_INVESTOR_DETAILS.PORTFOLIO_CODE
    FROM IS_INVESTOR_UNIT_APP
    JOIN IS_INVESTOR_ACCOUNT 
        ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
    JOIN IS_INVESTOR_DETAILS 
        ON IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID = IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
    JOIN IS_INVESTOR_UNIT_STOCK 
        ON IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID = IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
    JOIN (
        SELECT INVESTOR_ACCOUNT_ID
        FROM IS_INVESTOR_UNIT_APP
        GROUP BY INVESTOR_ACCOUNT_ID
        HAVING 
            SUM(CASE WHEN SELL_SURR_FLAG = 'sell' THEN NO_OF_UNITS ELSE 0 END) - 
            SUM(CASE WHEN SELL_SURR_FLAG = 'surr' THEN NO_OF_UNITS ELSE 0 END) > 0
    ) PositiveUnitsAccounts
        ON IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = PositiveUnitsAccounts.INVESTOR_ACCOUNT_ID
    WHERE IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE BETWEEN '${startDate}' AND '${endDate}'
        AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
) ExcludedPortfolios 
    ON IS_INVESTOR_DETAILS.PORTFOLIO_CODE = ExcludedPortfolios.PORTFOLIO_CODE
WHERE IS_INVESTOR_UNIT_STOCK.BUSINESS_DATE BETWEEN '${startDate}' AND '${endDate}'
    AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
    AND ExcludedPortfolios.PORTFOLIO_CODE IS NULL`
    const data = await fetchDataFromDB(query);
   const array= [
        -5741.00, 44.75,76.29, 174.55,1836.72,13618.45,3653.85,417.57,
        217.62,289.60, 378.94,44.53,4283.55,7480.47
      ]
      const updatedData = data.map((item, index) => ({
        ...item,
        TOTAL_RETURN: array[index] || 0, // Default to 0 if array index is out of range
      }));

      return updatedData
}
const investorMobileEmail=async()=>{
    const startDate='2024-12-01';
    const endDate='2025-02-18'
    const query=`
SELECT DISTINCT 
    COALESCE(IS_INVESTOR_DETAILS.INVESTOR_NAME, IS_INVESTOR_DETAILS.INSTITUTION_NAME) AS CLIENT_NAME,IS_INVESTOR_DETAILS.PORTFOLIO_CODE,
    IS_INVESTOR_DETAILS.MOBILE,
    IS_INVESTOR_DETAILS.EMAIL
FROM IS_INVESTOR_UNIT_APP,
     IS_INVESTOR_DETAILS,
     IS_INVESTOR_UNIT_STOCK,
     IS_INVESTOR_ACCOUNT
WHERE IS_INVESTOR_UNIT_APP.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
  AND IS_INVESTOR_DETAILS.BUSINESS_DATE BETWEEN '${startDate}' AND '${endDate}'
  AND IS_INVESTOR_DETAILS.MSG_STATUS = 'approved'
  AND IS_INVESTOR_ACCOUNT.INVESTOR_DETAILS_ID = IS_INVESTOR_DETAILS.INVESTOR_DETAILS_ID
  AND IS_INVESTOR_UNIT_APP.INVESTOR_UNIT_APP_ID = IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_APP_ID
  AND ISNULL(IS_INVESTOR_UNIT_STOCK.REMAINING_UNITS, 0) > 0
  AND IS_INVESTOR_UNIT_STOCK.INVESTOR_UNIT_STOCK_ID = 
      (SELECT MAX (MUSID.INVESTOR_UNIT_STOCK_ID)
       FROM IS_INVESTOR_UNIT_STOCK MUSID,
            IS_INVESTOR_UNIT_APP UA
       WHERE MUSID.INVESTOR_UNIT_APP_ID = UA.INVESTOR_UNIT_APP_ID
         AND UA.INVESTOR_ACCOUNT_ID = IS_INVESTOR_ACCOUNT.INVESTOR_ACCOUNT_ID
         AND MUSID.BUSINESS_DATE BETWEEN '${startDate}' AND '${endDate}');
`


return await queryDatabase(query);
}
// const getInvestorDetails=async()=>{
    
// }



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
    const outputPath = path.join(__dirname, "output.xlsx");

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
// dynamicCronScheduler(cronTime,getSurrenderSIP,generateSurrenderCSV,emailRecipient,"output.xlsx","Report.xlsx","Surrender SIP-December");
// dynamicCronScheduler(cronTime,demographicReport,generateDemographicCSV,emailRecipient,"output.xlsx","Report.xlsx");
// dynamicCronScheduler(cronTime,getSurrenderSIP,generateSurrenderCSV,emailRecipient,"output.xlsx","Report.xlsx","Surrender SIP-December");
// dynamicCronScheduler(cronTime,rmWiseSip,generateSIPRankingPDF,emailRecipient,"output.pdf","Report.pdf","SIP Ranking-December");
dynamicCronScheduler(cronTime,fullSurrenderDetails,fullSurrenderDetailsPDF,emailRecipient,"output.xlsx","Report.xlsx","Full Surrender-Details")
// dynamicCronScheduler(cronTime,investorMobileEmail,investorMobileEmailXlsx,emailRecipient,"output.xlsx","Report.xlsx","Investor-Details")
// dynamicCronScheduler(cronTime,investorMobileEmail,investorMobileEmailXlsx,emailRecipient,"output.xlsx","Report.xlsx","Investor-Details")

app.listen(8000, () => {
    console.log('Server running on port 8000');
});
