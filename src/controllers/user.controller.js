import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js"
import { User } from "..//models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiRespones.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        
        const user = await User.findById( userId )
        //console.log("User :" , user)
        const accessToken = user.generateAccessToken()
        //console.log("Access Token : ",accessToken)
        const refreshToken = await user.generateRefreshToken() // problem occcured
        //console.log("Refresh Token :" , refreshToken)
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        console.log("generateAccessAndRefreshTokens Error",error)
        throw new apiError(500, "Something Went Wrong While Generating Access or Refresh Token")
    }
}

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

const loginUser = asyncHandler( async ( req,res )=> {

    // todos
    // req body -> data
    // phone or email to access the user for login
    // find the user
    // password check
    // access and refresh token
    // send cookeis
    // send response

    const { email , phone , password } = req.body
    if (!(email || phone )) {
        throw new apiError(400,"Email or Phone number is required")
    }

    const user = await User.findOne({
        $or:[{email},{phone}]
    })

    if (!user) {
        throw new apiError(404,"User Does not exit with given Email or Phone please try to Register the User First")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new apiError(401,"Invalid User Credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie( "accessToken" , accessToken, options )
    .cookie( "refreshToken" , refreshToken , options )
    .json(
        new apiResponse (
            200,
            {
                user : loggedInUser , accessToken , refreshToken
            },
            "User Logged In Successfully"
        )
    )

})

const logOutUser = asyncHandler (async (req,res) =>{

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new apiResponse(200,{}, "User Logged Out Successfully"))
})

const refreshAccessToken = asyncHandler( async (req , res) =>{

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401 , "Unthorized Refresh Token request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new apiError(401 , "Invalid Refresh Token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401 , "Refresh Token Expired or Used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new apiResponse(
                200,
                {accessToken,refreshToken: newRefreshToken},
                "Access Token Refreshed Successfully !"
    
            )
        )
    } catch (error) {
        throw new apiError(401,error?.message || "Something went wrong while refreshing Access Token")
    }
})

export { 
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken
 }