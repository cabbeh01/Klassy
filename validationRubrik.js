//Här sker validering av inmatningen på inloggningen i Klassy

const Joi = require("@hapi/joi");

module.exports = async function(req,res,next){
    const schema = Joi.object({
        rubrik: Joi.string()
    });

    
    try {
        const value = await schema.validateAsync({ rubrik: req.body.rubrik});
        schema.validate(req.body);
        next();
    }
    catch (err) { 
        req.err = err;
        next();
    }
}