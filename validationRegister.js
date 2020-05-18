
//Här sker validering av inmatningen på registeringen i Klassy
//Importerar ett bibliotek som heter Joi. Detta används för att validera inmatningen på servern
//Jag har även använt mig av validering på client sidan men det kan man som användare passera ifall
//Man har kunskaper om html osv.

const Joi = require("@hapi/joi");

//Jag skapar en modul som jag exporterar
//Valideringen kan ta tid därför jag använt mig av async
module.exports = async function(req,res,next){

    //Först skapar jag ett så kallat schema som är en mall på de objekt som ska valideras
    //Samt vad för typ av validering som ska ske på de olika variablarna
    const schema = Joi.object({
        //T.ex. namnet ska vara en sträng med max 50 tecken
        name: Joi.string().max(50),
        //Emailen ska vara en sträng och en mail. Den är ett måste också att man skriver in
        email: Joi.string().email().required(),
        //Lösenordet är en sträng med minst 7 tecken och max 20 tecken
        password: Joi.string().min(7).max(20),
        //Repeatpassword ska stämma överens med password
        repeat_password: Joi.ref('password')
    });

    
    try {
        //Här kopplar jag ihop objektet jag får från post formen så att respektive värde kan valideras
        //Detta görs föra att undvika XSS scripting
        await schema.validateAsync({ 
            name:req.body.name, 
            email: req.body.email, 
            password: req.body.password, 
            repeat_password:req.body.repassword});
        
        schema.validate(req.body);
        
        //Går allt som det ska skickas användaren vidare till den nästkommande middlewaren eller in i routen
        next();
    }
    catch (err) { 
        //Uppstår ett fel lagras det i req.err och tas upp i routen
        req.err = err;
        next();
    }
}

