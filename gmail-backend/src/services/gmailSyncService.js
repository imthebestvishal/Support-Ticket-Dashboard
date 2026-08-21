import { User } from "../models/user.js";
import { fetchAndAnalyzeMessages } from "./gmailService.js";

let running = false;

export async function startGmailAutoSync(){

    if(running) return;

    running = true;

    console.log("AI Gmail Auto Sync Started");

    setInterval(async()=>{

        try{

            const users = await User.find({
                googleId: {$exists:true, $ne:null},
                accessToken: {$exists:true, $ne:""},
                refreshToken: {$exists:true, $ne:""}
            }).sort({
                updatedAt: -1
            }).limit(1);


            for(const user of users){

                console.log(
                  "Checking Gmail:",
                  user.email
                );


                await fetchAndAnalyzeMessages(
                    user._id
                );

            }


        }catch(error){

            console.error(
              "Auto sync error:",
              error.message
            );

        }


    }, 60 * 1000);
}





