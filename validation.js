const Joi = require("@hapi/joi");

module.exports = async function(req,res,next){
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(7).max(20),
        repeat_password: Joi.ref('password')
    });

    
    try {
        const value = await schema.validateAsync({ username: 'abc', birth_year: 1994 });
        schema.validate(req.body);
        next();
    }
    catch (err) { 

        next();
    }
}