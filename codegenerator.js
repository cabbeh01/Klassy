module.exports = function(antal){
    let i ="";
    let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

    for(let j = 0; j<antal;j++){
        let x = Math.floor(Math.random() * characters.length);
        i = i+characters[x];
    }
    
    return i;
}