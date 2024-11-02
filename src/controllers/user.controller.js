import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js"
import { User } from "..//models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiRespones.js";

const registerUser = asyncHandler( async (req, res) => {

// get user details from frontend....
// validation..not empty etc
// check if user already exist.. userName , E-mail etc
// check for image , check for avtar..
// upload them to cloudinary , avatar
// create user object - create entry in db
// remove password and refresh token field from response
// check for user creation 
// return response

const { name , email , phone , password , address} = req.body
console.log("E-mail :" , email);

    if (
        [name,email,phone,password,address].some((field)=>
            field?.trim() ==="" )
    ) {
        throw new apiError(400,"All Field are required")
    }

    const existedUser = await User.findOne({
        $or:[{email},{phone}]
    })

    if (existedUser){
        throw new apiError(409,"User with Email or Phone is already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path ;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path ;

    let coverImageLocalPath ;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
        coverImageLocalPath = req.files.coverImage[0].path 
    }

    //console.log(req.files);

    if (!avatarLocalPath) {
        
        throw new apiError(400,"Avatar File is Required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new apiError(400,"Avatar File is Required")
    }

    const user = await User.create({
        name,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        phone,
        address,
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //console.log("User Created !!-1")
    if (!createdUser) {
        throw new apiError(500,"Something Went Wrong While Registering The User...")
    }
    
    res.status(200).json(
        new apiResponse(200,createdUser,"User Registered Successfully...")
    )
    //res.status(201).json({createdUser})
    //User.findOne({email})
// if(name === ""){
    //     throw new apiError(400,"Full Name Is required")
    // }

    // just for test........
    // res.status(200).json({
    //     message:"ok"
    // })

})

export { registerUser }