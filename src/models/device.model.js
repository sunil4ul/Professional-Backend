import mongoose ,{Schema} from "mongoose";

const deviceSchema = new Schema({

    deviceName :{
        type : String,
        required : true       
    },
    deviceHWModel :{
        type : String,
        required : true        
    },
    deviceCode :{
        type : String,
        required : true      
    },
    deviceMac :{
        type : String,
        required : true,
        trim  : true      
    },
    userId :{
        type : Schema.Types.ObjectId,
        ref  : "User"
    },
    remoteCode :{
        type : String,
        required : true,
        trim  : true      
    },
    switchColor :{
        type : String,
        required : true,
        trim  : true      
    },
    deviceIp :{
        type : String,
        required : true,
        trim  : true      
    },
    deviceHost :{
        type : String,
        required : true,
        trim  : true      
    },
    wifiSSID :{
        type : String,
        required : true,
        trim  : true      
    },
    wifiPassword :{
        type : String,
        required : true,
        trim  : true      
    },
    from :{
        type : String,
        required : true,
        trim  : true      
    },
    switch :[
        {type : String,}
    ],
    speed :[
        {type : String,}
    ]


},
{
 timestamps : true
}
)

export const Device = mongoose.model("Device",deviceSchema)