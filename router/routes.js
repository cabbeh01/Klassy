//let objectId = require('mongodb').ObjectID;
const jwt = require('jsonwebtoken');
//const secret = require('./secret');
const bcrypt = require('bcryptjs');
const codeGen = require("../codegenerator.js");
const mail = require("../mail.js");
const valiInputLogin = require("../validationLogin.js");
const valiInputRegister = require("../validationRegister.js");

module.exports = async function(app,io){
    
    
    
    //Main page
    app.get("/", auth, async function(req,res){
        try{
            
            if(app.currentGroup == "1" || app.currentGroup == "0"){
                
                user = await getUser(req,res);

                res.render('index',{title:"Home",layout:"loggedin", user:user});
            }
            else{
                res.render('index',{title:"Home"});
            }
        }
        catch(err){
            console.log(err);
        }
        
    });

    //Login
    app.get("/login",loggedinRedirector,function(req,res){
        res.render('login',{title:"Inlogging"});
    });

    app.post("/login",valiInputLogin, async function(req,res){

        try{
            let inEmail = req.body.email;
            let pass = req.body.password;
            
            if(!req.err){
                await app.users.findOne({"email": inEmail},function(err,data){
    
                    if(!(data == null)){
                        //console.log(data.password);
                        //console.log(pass);
                        if(data.verified){
                            bcrypt.compare(pass,data.password,function(err,succ){
        
                                console.log(err);
                                console.log(succ);
                                if(succ){
                                    
                                    const token = jwt.sign(data,process.env.PRIVATEKEY,{expiresIn:3600});
                                    res.cookie("token",token,{httpOnly:true, maxAge:(2 * 24 * 60 * 60 * 1000),sameSite: 'strict'});
            
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
                                    res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt", email:req.body.email});
                                }
                            });
                        }
                        else{
                            res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt", email:req.body.email});
                        }
                        
                    }
                    else{
                        res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt", email:req.body.email});
                    }
                });
            }
            else{
                //console.log(req.err);
                res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt", email:req.body.email});
            }
            
        }
        catch(err){
            res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt", email:req.body.email});
        }
        
        
    });


    //Register
    app.get("/register",loggedinRedirector,function(req,res){
        res.render('register',{title:"Registrering"});
    });

    app.post("/register",valiInputRegister,async function(req,res){
        if(!req.err){
            bcrypt.hash(req.body.password,12,async function(err,hash){
                let inEmail = req.body.email;
                
                    await app.users.findOne({"email": inEmail},async function(err,data){
                    
                        if(data == null){
                            
                            req.body.password = hash;
                            req.body.verified =  false;
                            let code = codeGen(26);
                            req.body.verifyCode = code;
                            await app.users.insertOne(req.body,function(err,result){
                                
                                //console.log(err);
                                //console.log(result.insertedId);
                                mail(req.body.email,"Verify account","Var vänligen och verifiera dig!","http://localhost:2380/confirm/"+result.ops[0]._id+"/"+code);
                                
                            });
                            res.redirect("/login");
                        }
                        else{
                            res.render('register',{title:"Registrering", errmess:"Går inte registrera användaren", name: req.body.name, class: req.body.class, email: req.body.email});
                        }
                        
                    });
            });

        }
        else{
            //console.log(req.err);
            res.render('register',{title:"Registrering", errmess:"Går inte registrera användaren", name: req.body.name, class: req.body.class, email: req.body.email});
        }
        //res.send(req.body.group);
    });

    //Confirmation after registation
    app.get("/confirm/:id/:code", async function(req,res){
        try{
            let id = req.params.id;
            await app.users.findOne({"_id": app.objID(id)},async function(err,data){
                //console.log(data);
                try{
                    if(data.verifyCode == req.params.code){
                        data.verified = true;
                        await app.users.updateOne({"_id":app.objID(id)},{$set:{verified:true}},function(err){
                            console.log(err);
                        });
                        res.render("confirm",{title:"Verifierad",mess:"Du är nu verifierad och kan logga in"});
                    }
                    else{
                        res.render("confirm",{title:"Det gick inte att verifiera",mess:"Det gick inte att verifiera"});
                    }
                }
                catch{
                    res.render("confirm",{title:"Det gick inte att verifiera",mess:"Det gick inte att verifiera"});
                }
                
            });
            
        }
        catch(err){
            //console.log(err);
            res.redirect("/");
        }
    });
    
    //Sessions
    app.get("/session",verifiedAcc,function(req,res){
        res.redirect("/");
    });

    //Pupil or guest connecting to a session
    app.get("/session/:id",verifiedAcc,async function(req,res){
        user = await getUser(req,res);

        //user = await app.users.findOne()
        //console.log(user);
        res.render("session",{title:"Elev inloggad | "+ req.params.id,code:req.params.id,
        io:`
        <script>
        var socket = io("/${req.params.id}");
        socket.on('connect', function () {
            socket.emit('user',${JSON.stringify(user)});
            socket.emit('hi');
          });

        socket.on('disconnect', function () {
           socket.emit(${JSON.stringify(user)});
          });
        </script>
        `,
        user:user,layout:"loggedin"})
    });


    app.post("/session",verifiedAcc,async function(req,res){
        res.redirect("/session/" + req.body.code);
    });

    //Teacher starting a session
    app.get("/lesson/:id",verifiedAcc, async function(req,res){
        const c = req.params.id;
        const socket = io.of('/' + c);
        
        socket.on('connection', function(socket){
            
            socket.on('user', function (usr) { 
                console.log(usr.name + " connected on code: " + c);
            });
            socket.on('disconnect', function (usr) { 
                console.log(usr.name + " disconnected from code: " + c);
            });
            //res.render("lesson",{title:"Lektion: " + c,code:c,layout:"loggedin",user:user})
        });

        res.render("lesson",{title:"Lektion: " + c,code:c,layout:"loggedin",user:user})
    });

    app.post("/preplesson", function(req,res){
        res.render("preplesson",{title:"Lektion: ",layout:"loggedin",user:user});
    });

    app.post("/startlesson", function(req,res){
        console.log(req.body);
        const code = codeGen(6);
        res.redirect("/lesson/" + code);
    });

    //Lärare
    app.get("/teacher",verifiedAcc,auth,async function(req,res){
        user = await getUser(req,res);
        if(app.currentGroup == "0"){
            res.render("teacher",{title:"Lärare inloggad",layout:"loggedin", user:user});
        }
        else if(app.currentGroup == "1"){
            res.redirect("/pupil");
        }
        else{
            res.redirect("/login");
        }
    });


    io.on('connection', (socket) => {

        console.log(socket.id + ' uppkopplad mot servern')
        socket.room = 'default';
        socket.join('default')
        socket.isOwner = false;
    
        //---------------------------------Läraren skapar sina rum här---------------------------------
        socket.on('create_room', (data) => {
            try {
                
            }
            catch (error) {
                
            }
    
        })
    
        //---------------------------------Eleverna joinar dem här---------------------------------
        socket.on('join_room', (data) => {
            try {
                
    
            }
            catch (error) {
                console.error(error);
                socket.emit('client_error', "Kunde inte joina rummet.");
            }
        })
        //---------------------------------Lämna rummet---------------------------------
        socket.on('left_room', (data) => {
            try {
                
            }
            catch (error) {
               
            }
        })
       
    
        //---------------------------------Stänger webbläsaren---------------------------------
        socket.on('disconnect', function () {
            try {
                
            }
            catch (error) {
                console.error(error);
            }

        });
    })



    //Elev
    app.get("/pupil",verifiedAcc,auth,async function(req,res){
        user = await getUser(req,res);
        if(app.currentGroup == "1"){
            res.render("pupil",{title:"Elev inloggad",layout:"loggedin",user:user});
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

    async function verifiedAcc(req,res,next){
        user = await getUser(req,res);
        if(!user.verified){
            res.render('login',{title:"Ej verifierad", errmess:"Du måste verifiera ditt konto vänligen kolla din inkorg"});
        }
        else{
            next();
        }
    }

    function auth(req,res,next){
        
        try{
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
        catch(err){
            console.log(err);
        }
        
        
    }

    function loggedinRedirector(req,res,next){
        try{
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
        catch(err){
            console.log(err);
        }
    }


    function verifyToken(req,res){
        try{
            return new Promise(function(resolve,reject){
                let token = req.cookies.token;
                jwt.verify(token,process.env.PRIVATEKEY, function(err,decoded){
                    if(decoded !== undefined){
                        resolve(decoded)
                    }
                    else{
                        reject(0)
                    }
                });
            });
        }
        catch(err){
            console.log(err);
        }
        
    }


    async function getUser(req,res){

        try{
            let decodedToken = await verifyToken(req,res);

            return new Promise(function(resolve,reject){
                app.users.findOne({"email": decodedToken.email},function(err,data){        
                    if(!(data == null)){
                        resolve(data);
                    }
                    else{
                        reject(0);
                    }
                });
            });
        }
        catch(err){
            console.log(err);
        }
        
        
    }

    
    
}