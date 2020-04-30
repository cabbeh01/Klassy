//Här sker validering av inmatningen på inloggningen i Klassy

const Joi = require("@hapi/joi");

module.exports = async function(req,res,next){
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(7).max(20)
    });

    
    try {
        const value = await schema.validateAsync({ email: req.body.email, password: req.body.password });
        schema.validate(req.body);
        next();
    }
    catch (err) { 
        req.err = err;
        next();
    }
}