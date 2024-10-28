import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async ()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
        //const connectionInstance = await mongoose.connect(`mongodb+srv://sunil4us-1:Sunil123@cluster0312.ofcnf.mongodb.net/${DB_NAME}`);
        console.log(`\n MongoDB Connected !! DB host : ${connectionInstance.connection.host}`);

    } catch (error) {
        console.log(`POrt : ${process.env.PORT}`)
        console.log("MongoDB Connection Error : ",error)
        process.exit(1)
    }
}

export default connectDB