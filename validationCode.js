//Här sker validering av inmatningen på registeringen i Klassy

const Joi = require("@hapi/joi");

module.exports = async function(req,res,next){
    const schema = Joi.object({
        code: Joi.string().max(6)
    });

    
    try {
        const value = await schema.validateAsync({ code:req.params.id});
        schema.validate(req.params);
        req.err = null;
        next();
    }
    catch (err) { 
        //console.log(err);
        req.err = err;
        next();
    }
}