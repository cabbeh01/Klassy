//Här sker validering av inmatningen på koderna i Klassy

const Joi = require("@hapi/joi");

module.exports = async function(req,res,next){
    
    //Lagrarvariabler från body och parmms i
    //separata variabler
    codeB = req.body.code;
    codeP = req.params.id;

    const schema = Joi.object({
        //Maxlängd på kod 6 tecken
        code: Joi.string().max(6)
    });

    
    try {
        //Validerar så att det stämmer överens
        const value = await schema.validateAsync({ code:codeP, code:codeB});
        schema.validate(req.params);

        //Om allt fungerar
        //skickas vi vidare till nästa middleware eller route
        req.err = null;
        next();
    }
    catch (err) { 
        //Lögger till felet i req.err 
        req.err = err;
        next();
    }
}

