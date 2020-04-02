const nodemailer = require("nodemailer");

module.exports = function(receiver,subjectText,data,route){
    async function main() {
        // Create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
          host: "mail.te17cahe.kgwebb.se",
          port: 465,
          secure: true, 
          auth: {
            user: "klassy@te17cahe.kgwebb.se", // mail
            pass: process.env.MAILPASS // password
          }
        });
      
        // Send mail with defined transport object
        let info = await transporter.sendMail({
          from: '"Klassy support" <klassy@info.com>', // Sender address
          to: receiver, // Receivers/Receivers
          subject: subjectText, // Subject line
          text: data, // Plain text body
          html: "<a href='"+route+"'>Klicka här för verifiera ditt konto</a>" // Html body
        });
      
        console.log("Message sent: %s", info.messageId);
        // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
      }
      
      main().catch(console.error);
}