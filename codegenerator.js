//Denna modulen generarar koder till klassrummen

module.exports = function(antal){
    //En tom sträng varibael som ska bli koden
    let i ="";

    //Alla karaktärer som ska kunna finnas med i koden
    let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

    //Slumpar fram en karaktär i taget tills nått antalet karaktärer som ska finnas i den slumpade koden
    for(let j = 0; j<antal;j++){

        //Slumpar ett tal som finns inom fältets ramar
        let x = Math.floor(Math.random() * characters.length);

        //Hämtar och lägger till karaktärerna efter varandra
        i = i+characters[x];
    }
    
    //Returnerar koden
    return i;
}