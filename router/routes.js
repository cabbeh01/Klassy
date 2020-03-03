//let objectId = require('mongodb').ObjectID;
const jwt = require('jsonwebtoken');
//const secret = require('./secret');
const bcrypt = require('bcryptjs');
const codeGen = require("../codegenerator.js");

module.exports = async function(app,io){
    
    

    //Main page
    app.get("/",auth, function(req,res){
        if(app.currentGroup == "1" || app.currentGroup == "0"){
            res.render('index',{title:"Home",layout:"loggedin"});
        }
        else{
            res.render('index',{title:"Home"});
        }
        
    });

    //Login
    app.get("/login",loggedinRedirector,function(req,res){
        res.render('login',{title:"Inlogging"});
    });

    app.post("/login", async function(req,res){

        let inEmail = req.body.email;
        let pass = req.body.password;

        await app.users.findOne({"email": inEmail},function(err,data){

            if(!(data == null)){
                //console.log(data.password);
                //console.log(pass);
                bcrypt.compare(pass,data.password,function(err,succ){

                    console.log(err);
                    console.log(succ);
                    if(succ){

                        const token = jwt.sign(data,process.env.PRIVATEKEY,{expiresIn:3600});
                        res.cookie("token",token,{httpOnly:true,sameSite: 'strict'});

                        switch(data.group){
                            case "0":
                                res.redirect("/teacher");
                                break;
                            case "1":
                                res.redirect("/pupil");
                                break;
                        }
                    }
                    else{
                        res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt"});
                    }
                });
            }
            else{
                res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt"});
            }
        });
    });


    //Register
    app.get("/register",loggedinRedirector,function(req,res){
        res.render('register',{title:"Registrering"});
    });

    app.post("/register",async function(req,res){
        bcrypt.hash(req.body.password,12,function(err,hash){
            let inEmail = req.body.email;
            
            app.users.findOne({"email": inEmail},function(err,data){
                
                if(data == null){
                    req.body.password = hash;

                    app.users.insertOne(req.body,function(err){
                        //console.log(err);
                    });
                    res.redirect("/login");
                }
                else{
                    res.render('register',{title:"Registrering", errmess:"Går inte registrera användaren"});
                }
                
            });

        });
        //res.send(req.body.group);
    });

    
    //Sessions
    app.get("/session",function(req,res){
        res.send("/");
    });

    //Pupil or guest connecting to a session
    app.get("/session/:id",async function(req,res){
        user = await getUser(req,res);
        console.log(user);
        res.render("session",{title:"Elev inloggad | "+ req.params.id,code:req.params.id,io:"<script>const socket = io('/"+ req.params.id + "');</script>",email:user,layout:"loggedin"})
    });

    app.post("/session",async function(req,res){
        res.redirect("/session/" + req.body.code);
    });

    //Teacher starting a session
    app.get("/lesson/:id", function(req,res){
        const c = req.params.id;
        const nsp = io.of('/' + c);
        
        nsp.on('connection', function(socket){
            
            console.log('someone connected on code: ' + c);
        });

        res.render("lesson",{title:"Lektion: " + c,code:c,layout:"loggedin"})
    });
    app.post("/startlesson", function(req,res){
        const code = codeGen(6);
        res.redirect("/lesson/" + code);
    });

    //Lärare
    app.get("/teacher",auth,function(req,res){
        
        if(app.currentGroup == "0"){
            res.render("teacher",{title:"Lärare inloggad",layout:"loggedin"});
        }
        else if(app.currentGroup == "1"){
            res.redirect("/pupil");
        }
        else{
            res.redirect("/login");
        }
    });

    //Elev
    app.get("/pupil",auth,function(req,res){
        if(app.currentGroup == "1"){
            res.render('pupil',{title:"Elev inloggad",layout:"loggedin"});
        }
        else if(app.currentGroup == "0"){
            res.redirect("/teacher");
        }
        else{
            res.redirect("/login");
        }
    });


    

    //Logout
    app.get("/logout",function(req,res){
        app.currentGroup = undefined;
        res.clearCookie("token");
        res.redirect("/");
    });

    function auth(req,res,next){
        
        let token = req.cookies.token;

        if(!(token === undefined)){
            jwt.verify(token,process.env.PRIVATEKEY, async function(err,decoded){
                if(decoded !== undefined){
                    await app.users.findOne({"email": decoded.email},function(err,data){
                        
                        if(!(data == null)){
                            //console.log(data.group);
                            if(data.password == decoded.password){
                                app.currentGroup = data.group;
                                next();
                            }
                            else{
                                app.currentGroup = undefined;
                                next();
                            }
                        }
                        
                    });
                }
            });
        }
        else{
            res.clearCookie("token");
            app.currentGroup = undefined;
            next();
        }
        
    }

    function loggedinRedirector(req,res,next){
        if(app.currentGroup == "0"){
            res.redirect("/teacher");
        }
        else if(app.currentGroup == "1"){
            res.redirect("/pupil");
        }
        else{
            next();
        }
    }

    async function getUser(req,res){
        let token = req.cookies.token;

        let outData = null;
        if(!(token === undefined)){
            await jwt.verify(token,process.env.PRIVATEKEY, async function(err,decoded){
                console.log("fsdfsd");
                if(decoded !== undefined){
                    await app.users.findOne({"email": decoded.email},function(err,data){
                        
                        if(!(data == null)){
                            console.log(data);
                            outData = data;
                        }
                        else{
                            //return 0;
                        }
                        
                    });
                }
                else{
                    //return 0;
                }
            });
            console.log("dsdasd");
        }
        else{
            //return 0;
        }
        console.log("ccccc");
        return outData;
    }
}