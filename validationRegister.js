const Joi = require("@hapi/joi");

module.exports = async function(req,res,next){
    const schema = Joi.object({
        name: Joi.string().max(50),
        email: Joi.string().email().required(),
        password: Joi.string().min(7).max(20),
        repeat_password: Joi.ref('password')
    });

    
    try {
        const value = await schema.validateAsync({ name:req.body.name, email: req.body.email, password: req.body.password, repeat_password:req.body.repassword});
        schema.validate(req.body);
        next();
    }
    catch (err) { 
        req.err = err;
        next();
    }
}