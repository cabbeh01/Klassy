const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const codeGen = require("../codegenerator.js");
const mail = require("../mail.js");
const valiInputLogin = require("../validationLogin.js");
const valiInputRegister = require("../validationRegister.js");
const valiInputCode = require("../validationCode.js");

module.exports = async function(app,io){
    
    //Startsida
    app.get("/", auth, async function(req,res){
        
        try{
            //Kontrollerar ifall användaren är inloggad
            if(app.currentGroup == "1" || app.currentGroup == "0"){
                //Hämtar användar datan från mongoDB databas
                user = await getUser(req,res);
                res.render('index',{title:"Home",layout:"loggedin", user:user});
            }
            else{
                res.render('index',{title:"Home"});
            }
        }
        catch(err){
            console.log(err);
            res.render('index',{title:"Home"});
        }
        
    });

    //GET- Login detta visas när användaren kommer till login
    app.get("/login",loggedinRedirector,function(req,res){
        res.render('login',{title:"Inlogging"});
    });

    //När användaren skrivit in sina inloggningsuppgifter kommer de att berabetas
    //Först valideras inmatningen
    app.post("/login",valiInputLogin, async function(req,res){

        try{
            //Lägger email och lösen i separata varibler så det blir lätt att komma åt
            let inEmail = req.body.email;
            let pass = req.body.password;
            
            //Om inget fel har uppstått
            if(!req.err){
                
                //Leta upp eposten på databasen
                await app.users.findOne({"email": inEmail},function(err,data){
    
                    //Hittar den en användare som har eposten
                    if(!(data == null)){
                       
                        //Kollar ifall användaren är verifierad och är den det så fortsätter inloggningen
                        if(data.verified){

                            //Lösenorden jämförs
                            bcrypt.compare(pass,data.password,function(err,succ){
        
                                //Fungerar allt som det ska och lösenorden stämmer överens
                                if(succ){

                                    //Skapar en token som ska lagras i cookien så att användaren kan gå mellan routes utan att behöva
                                    //logga in igen. Detta har jag löst med att använda JWT (Json Web Token) detta bibliotek gör att
                                    //man kan lagra information krypterat. Samt sätta en ålder på det
                                    const token = jwt.sign(data,process.env.PRIVATEKEY,{expiresIn:"1 day"});
                                    res.cookie("token",token,{httpOnly:true, maxAge:(2 * 24 * 60 * 60 * 1000),sameSite: 'strict'});
            
                                    //Beroende på vilken behörighetsgrupp man tillhör så redirectar man till olika saker
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
                                    res.render('login',{title:"Registrering",
                                    errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
                                }
                            });
                        }
                        else{
                            res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
                        }
                        
                    }
                    else{
                        res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
                    }
                });
            }
            else{
                //console.log(req.err);
                res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
            }
            
        }
        catch(err){
            res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
        }
        
        
    });


    //Registrering
    //GET-route som läser in html för användaren med hjälp av ett bibliotek som heter handelbars
    app.get("/register",loggedinRedirector,function(req,res){
        res.render('register',{title:"Registrering"});
    });

    //När användaren klickar på en submitknapp i ett formulär hamnar hen i en postfunktion
    //När användaren registrerat sig kontrolleras först inmatningen i en middleware valiInputRegister
    app.post("/register",valiInputRegister,async function(req,res){
        try{

            //Kontrollerar så att inte problem har uppstått
            if(!req.err){
                //Jag användar mig av ett bibliotek som heter Bcrypt. Det gör jag för att säkerställa att
                //användarens lösenord kan förvaras säkert på databasen. Varje lösenord går igenom en process
                //där datorn lägger och slumpar runt teckena. Detta kommer göras 12 gånger. En hash kan inte knäckas
                //utan kan bara jämföras med en annan hash för att se ifall de är korrekta.
                bcrypt.hash(req.body.password,12,async function(err,hash){
                    
                    //Hämtar email
                    let inEmail = req.body.email;
                    
                        //Tar reda på ifall emailen finns i databasen
                        await app.users.findOne({"email": inEmail},async function(err,data){
                        
                            //Om den inte finns
                            if(data == null){
                                //Sätter vi hashen till användarens lösenord
                                req.body.password = hash;

                                //Tar bort repassword i objektet som är i klartext
                                delete req.body.repassword;

                                //Sätter användaren till ej verifierad då jag använder mig av tvåstegsverifiering
                                req.body.verified =  false;

                                //Genererar en verifieringskod
                                let code = codeGen(26);

                                //Lägger in verifieringskod i objektet
                                req.body.verifyCode = code;

                                //Lägger till användaren i användardatabasen
                                await app.users.insertOne(req.body,function(err,result){
                                    
                                    //Skickar ett bekräftelsemail mail till användarens-mail.
                                    mail(req.body.email,"Verify account","Var vänligen och verifiera dig!","http://localhost:2380/confirm/"+result.ops[0]._id+"/"+code);
                                });
                                
                                //Skickar en html sida till användaren att registrering gick igenom och berättar för hen att hen ska verifiera sitt konto med sin mail
                                res.render('login',{title:"Registrering avklarad", 
                                errmess:"<script>alertify.warning('Du är nu registrerad, ett mail har skickats till din inkorg. Vänligen bekräfta ditt konto!');</script>", 
                                name: req.body.name, class: req.body.class, email: req.body.email});
                            }
                            else{
                                
                                //Det gick inte registrera html, fast behåller de inmatade värdena förutom lösenordet
                                res.render('register',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att registrera');</script>", name: req.body.name, 
                                class: req.body.class, email: req.body.email});
                            }
                            
                        });
                });
    
            }
            else{
                //Felmeddelande skickas
                res.render('register',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att registrera');</script>", name: req.body.name, 
                class: req.body.class, email: req.body.email});
            }
        }
        catch{
            //Skulle det inte alls fungera så startas routen om
            res.redirect("/register");
        }
    });

    //Tvåstegsverifiering efter att man har registrerat sig
    app.get("/confirm/:id/:code", async function(req,res){
        try{
            //När anändaren registrerar sig skickas en länk i detta formatet 
            //Exempel  http://localhost:2380/confirm/hdjksahdsuai/djfldsfhsduflidshfsdflsd
            //                                          (id)                (code)
            
            //Hämtar id:et som följde med i epost-meddelandet
            let id = req.params.id;
            
            //Letar upp användaren med id:et
            await app.users.findOne({"_id": app.objID(id)},async function(err,data){
                
                try{
                    //Om den inte är verifierad
                    if(!data.verified){
                        
                        //Kontrollerar så att verifieringskoderna stämmer överens
                        if(data.verifyCode == req.params.code){
                            //Ändrar så att användaren är veriferad
                            data.verified = true;

                            //Uppdaterar användaren på databasen
                            await app.users.updateOne({"_id":app.objID(id)},{$set:{verified:true}},function(err){
                                console.log(err);
                            });

                            //Meddelar användaren att hen är veriferad
                            res.render("index",{title:"Verifierad",mess:"<script>alertify.success('Det är nu verifierad!');</script>"});
                        }
                        //Sedan massa felmeddelande ifall det inte fungerade
                        else{
                            res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.error('Det gick inte att verifiera');</script>"});
                        }
                    }
                    else{
                        res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.warning('Du är reda verifierad!');</script>"});
                    }
                    
                }
                catch{
                    res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.error('Det gick inte att verifiera');</script>"});
                }
                
            });
            
        }
        catch(err){
            res.redirect("/");
        }
    });
    
    //Sessions
    app.get("/session",verifiedAcc,function(req,res){
        res.redirect("/");
    });

    //Pupil or guest connecting to a session
    app.get("/session/:id",verifiedAcc,valiInputCode,async function(req,res){
        try{
            if(!req.err){
                let user = await getUser(req,res);
                let lesson = await getLesson(req.params.id);
    
                if(lesson){
                    res.render("session",{title:"Elev inloggad | "+ req.params.id, code:req.params.id, info:lesson.info, rubrik:lesson.rubrik,
                    io:`
                    <script>
                    let userID = "${user._id}";
                    let userName = "${user.name}";
                    
                    const socket = io('/${lesson.key}');
                    
                    socket.on('pupil', (data) => {
                        
                        if(data.userID == userID){
                            document.getElementById("helpbutton").style.backgroundColor = "#e1cc67";
                            document.getElementById("helpbutton").style.borderColor = "#b8a545";
                            document.getElementById("helpbutton").innerHTML = "Hjälp";
                            want = 0;
                        }
                    });

                    let want = 0;
                    function help(){
                        if(want == 1){
                            document.getElementById("helpbutton").style.backgroundColor = "#e1cc67";
                            document.getElementById("helpbutton").style.borderColor = "#b8a545";
                            document.getElementById("helpbutton").innerHTML = "Hjälp";
                            want = 0;
                        }
                        else{
                            console.log("Jag behöver hjälp");
                            document.getElementById("helpbutton").style.backgroundColor = "#e16767";
                            document.getElementById("helpbutton").style.borderColor = "#b84545";
                            document.getElementById("helpbutton").innerHTML = "Avbryt";
                            want = 1
                        }
                        
                        socket.emit("pupilchange",{userID,userName,status:want});
                        console.log(want);
                    }
                    </script>
                    `,
                    user:user,layout:"loggedin"})
                }
                else{
                    let user = await getUser(req,res);
                    res.render("pupil", {title:"Elev inloggad", erress:"<script>alertify.error('Finns inget lektion med den nyckeln');</script>",user:user,layout:"loggedin"})
                }
                
            }
            else{
                let user = await getUser(req,res);
                res.render("pupil", {title:"Elev inloggad", erress:"<script>alertify.error('Finns inget lektion med den nyckeln');</script>",user:user,layout:"loggedin"})
            }
            
        }
        catch(err){
            let user = await getUser(req,res);
            res.render("pupil", {title:"Elev inloggad", erress:"<script>alertify.error('Finns inget lektion med den nyckeln');</script>",user:user,layout:"loggedin"})
            console.log(err);
        }

    });


    app.post("/session",verifiedAcc,valiInputCode,async function(req,res){
        
        //Kollar så att koden är giltlig annars byt params till unknown
        //Detta gör för att inte kunna få felmeddelande så man hamnar i en annan site
        if(!req.err){
            res.redirect("/session/" + req.body.code);
        }
        else{
            res.redirect("/session/" + "unknown");
        }
    });

    





    
    //Lärare
    app.get("/teacher",verifiedAcc,teacherOnly,auth, async function(req,res){
        let user = await getUser(req,res);
        res.render("teacher",{title:"Lärare inloggad",layout:"loggedin", user:user});
    });

    
    //Lärare förbereder en lektion
    app.post("/preplesson",verifiedAcc,teacherOnly, function(req,res){
        res.render("preplesson",{title:"Lektion: ",layout:"loggedin",user:user, action:"/startlesson",button:"Skapa lektion"});
    });

    

    app.get("/preplesson/:id",verifiedAcc,teacherOnly, async function(req,res){
        try{
            code = req.params.id;
            let lesson = await getLesson(code);
            res.render("preplesson",{title:"Redigerar " + lesson.rubrik,rubrik:lesson.rubrik, info:lesson.info, layout:"loggedin",user:user,action:"/updatelesson", oid:lesson._id, button:"Uppdatera lektionen"});
        }
        catch(err){
           //res.redirect("lessons");
           console.log(err);
        }
    });
    app.post("/updatelesson",verifiedAcc,teacherOnly, async function(req,res){
        await updateLesson(req.body);
        ls = await listLessons(req,res, user);
        res.redirect("/teacher/lessons");
    });
    //Lärare startar en lektion
    app.post("/startlesson",verifiedAcc,teacherOnly, function(req,res){
        console.log(req.body.info);
        const code = codeGen(6);
        setLesson(req,res,code,user);
        res.redirect("/teacher/lesson/" + code);
    });


    app.get("/teacher/lessons",verifiedAcc,teacherOnly, async function(req,res){
        try{
            user = await getUser(req,res);
            ls = await listLessons(req,res, user);
            if(ls != ``){
                res.render("lessons",{lessons:ls, title:"Lektioner ",layout:"loggedin",user:user});
            }
            else{
                res.render("lessons",{lessons:"Det finns inga lektioner", title:"Lektioner ",layout:"loggedin",user:user});
            }
        }
        catch{
            res.redirect("/teacher");
        }
    });






    app.get("/teacher/lesson/:id",verifiedAcc,teacherOnly, async function(req,res){
        try{
            const c = req.params.id;
            let lesson = await getLesson(c);
            console.log(lesson.info);
            
            
            const lesNet = io.of('/'+c);
            lesNet.on('connection', function(socket){
                
                socket.on('pupilchange', function(data){
                    lesNet.emit('teacher', data);
                });
                socket.on('helpdone', function(data){
                    lesNet.emit('pupil', data);
                });
            });
            
    
            res.render("lesson",{title:"Lektion: " + c,code:c,layout:"loggedin",user:user, lessinf:lesson.info, rubrik:lesson.rubrik,
            io:`
                <script>
                    let users = [];
                    
                    const socket = io('/${lesson.key}');
                    let us = false;
                    socket.on('teacher', (data) => {
                        
                        if(users.length <= 0){
                            users.forEach(function(element){
                                
                                if(element.status == 0 || element.userID.toString() == data.userID.toString()){
                                    us = true;
                                }
                                
                               
                            });

                            if(us){
                                users = users.filter(function(x){
                                    return (x.userID.toString() != data.userID.toString());
                                });
                                
                            }else{
                                users.push(data);
                            }
                            us = false;
                            
                        }
                        drawTable();
                        console.log(users);
                    });
                    
                    function drawTable(){
                        let draw = "";
                        
                        users.forEach(function(element){
                            draw += template(element.userName.toString());
                        });
                        console.log(draw);
                        document.getElementById("list").innerHTML = draw;
                    }
                    
                    function template(name){
                        return "<li>"+ name +"</li>";
                    }

                    function lost(){
                        let user = users[0];
                        users.shift();
                        socket.emit("helpdone",user);
                    }
                </script>
            `});
        }
        catch(err){
            res.redirect("/teacher");
        }
        
    });



    app.get("/teacher/removeless/:id",verifiedAcc,teacherOnly, async function(req,res){
        try{
            let code = req.params.id;
        
            let lesson = await getLesson(code);
            res.render("removeless",{title:"Bekräfta bortagning av lektionen " + lesson.rubrik,key:code,lesson:lesson.rubrik,layout:"loggedin",user:user, lessinf:lesson.info, rubrik:lesson.rubrik});
        }
        catch{
            res.render("lessons", {title:"Elev inloggad", errmess:"<script>alertify.error('Det gick inte hitta lektionen');</script>",user:user,layout:"loggedin"});
        }

        
       
    });

    app.post("/teacher/removeless/confirm",verifiedAcc,teacherOnly, async function(req,res){
        
        try{
            let user = await getUser(req,res);
            let lesson = await getLesson(req.body.key);
    
            if(lesson.ownerId.toString() == user._id.toString()){
                if(removeLesson(req.body.key)){
                    res.redirect("/teacher/lessons");
                    
                }
                else{
    
                    res.render("lessons", {title:"Elev inloggad", errmess:"<script>alertify.error('Det gick inte ta bort lektionen');</script>",user:user,layout:"loggedin"});
                }
            }
            else{
                res.render("lessons", {title:"Elev inloggad", errmess:"<script>alertify.error('Det gick inte ta bort lektionen');</script>",user:user,layout:"loggedin"});
            }
        }
        catch{
            res.redirect("/teacher");
        }
        
        
        
    });




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

    app.get("*", async function(req, res){
        user = await getUser(req,res);
        if(!user){
            res.render('error', {title:"Fel",layout:"layout"});
        }
        else{
            res.render('error', {title:"Fel",layout:"loggedin", user:user});
        }
        
    });









    // ----------   Funktioner   ------------


    async function teacherOnly(req,res,next){
        try{
            //Hämtar användaren
            user = await getUser(req,res);
            //Kollar ifall användaren är en lärare
            if(user.group == 0){
                //Är användaren det så fortsätter vi in i routen
                next();
            }
            else{
                //Annars redirectar vi till elevens sida
                res.redirect("/pupil");
            }
        }
        catch{
            //Fungerar inget så redirectar vi till startsidan
            res.redirect("/");
        }
    }

    async function verifiedAcc(req,res,next){
        try{
            user = await getUser(req,res);
            if(!user.verified){
                res.render('login',{title:"Ej verifierad", errmess:"Du måste verifiera ditt konto vänligen kolla din inkorg"});
            }
            else{
                next();
            }
        }
        catch{
            res.redirect("/");
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
            //Kollar ifall det är en lärare inloggad och skickar
            //Läraren till sin sida
            if(app.currentGroup == "0"){
                res.redirect("/teacher");
            }
            //Kollar ifall det är en elev inloggad och skickar
            //eleven till sin sida
            else if(app.currentGroup == "1"){
                res.redirect("/pupil");
            }
            //Annars skickas användaren vidare till routen
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
                        req.cookies.token = "";
                        reject(0)
                    }
                });
            });
        }
        catch(err){
            req.cookies.token = "";
            res.redirect("/");
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



    async function listLessons(req,res,user){

        try{
            //console.log(user._id);
            let html = ``;
            return new Promise(function(resolve,reject){
                app.lessons.find().toArray(function(err,data){
                
                    //console.log(data);
                    let lessonId = data.filter(function(less){
                        return user._id.toString() == less.ownerId.toString();
                    })
                    //console.log(lessonId);
                        
                    lessonId.forEach(less => {
                        html += `   <div id="lessonpack">
                                    <li>${less.rubrik} <a href="/teacher/lesson/${less.key}">Visa</a><a href="/preplesson/${less.key}">Redigera</a><a href="/teacher/removeless/${less.key}">Ta bort</a></li>
                                    </div>                    
                                `;
                    });
                    console.log(html);
                    resolve(html);
                    if(err){
                        reject(null);
                    }
                });
                
                
            });
        }
        catch(err){
            console.log(err);
        }
        
    }

    async function setLesson(req,res,code,owner){

        try{
            let owne = owner;
            await app.lessons.findOne({"key": code},async function(err,data){
                var lesson = {key:code, info:req.body.info, ownerId:owner._id, rubrik:req.body.rubrik};
                if(data == null){
                    await app.lessons.insertOne(lesson,function(err,result){
                        if(err){
                            console.log(err);
                        }
                    });
                }
                else{
                    setLesson(req,res,codeGen(6),owne);
                }
                
            });
        }
        catch(err){
            console.log(err);
        }
    }

    async function updateLesson(lesson){

        try{
            await app.lessons.updateOne({"_id":app.objID(lesson.oid)},{$set:{info:lesson.info, rubrik:lesson.rubrik}},function(err){
                if(err){
                    console.log(err);
                }
            });
        }
        catch(err){
            console.log(err);
        }
    }

    function getLesson(code){

        try{
            return new Promise(async function(resolve,reject){
                await app.lessons.findOne({"key": code}, function(err,data){
                    console.log(code);
                    if(!err){
                        resolve(data);
                        
                    }
                    else{
                        reject(null);
                    }
                    
                });
            });
        }
        catch(err){
            console.log(err);
        }
    }
    
    function removeLesson(code){

        try{
            return new Promise(async function(resolve,reject){
                await app.lessons.deleteOne({"key": code}, function(err,data){
                    console.log(code);
                    if(!err){
                        resolve(true);
                        
                    }
                    else{
                        reject(false);
                    }
                    
                });
            });
        }
        catch(err){
            console.log(err);
        }
    }
    
}