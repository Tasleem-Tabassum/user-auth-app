/* eslint-disable linebreak-style */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import AWS, { dynamodb } from "../config/aws";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { User } from "../models/interfaces";
import { response } from "../models/response";

export const signUpController = async (name: string, userName: string, password: string, role: string, mobile: string): Promise<response> => {
    try {

        if(!userName || !password || !name || !mobile || !role) {
            return {
                statusCode: 400,
                body: "All the fields are mandatory"
            };
        }

        if(typeof userName !== "string") {
            return {
                statusCode: 400,
                body: "UserName must be a string"
            };
        }

        if(typeof password !== "string") {
            return {
                statusCode: 400,
                body: "Password must be a string"
            };
        }

        if(typeof name !== "string") {
            return {
                statusCode: 400,
                body: "Name must be a string"
            };
        }

        const queryDataParams = {
            TableName: process.env.USERS_TABLE || "",
            KeyConditionExpression: "UserName = :userName",
            ExpressionAttributeValues: {
                ":userName": userName,
            }
        };

        const userData = await dynamodb.query(queryDataParams).promise();

        if((userData.Items?.length) && (userData.Items[0]?.UserName !== undefined)) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "User already exists!"
                })
            };
        }

        const passwordHash = await bcrypt.hash(password, 8);

        const params = {
            TableName: process.env.USERS_TABLE || "",
            Item: {
                id: uuidv4(),
                UserName: userName,
                Password: passwordHash,
                Name: name,
                Role: role,
                MobileNumber: mobile,
                createdAt: new Date().toISOString()
            }
        };

        await dynamodb.put(params).promise();
        
        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "signup successful"
            })
        };
    } catch(error) {
        console.error("Error while signup:", error);
    
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Signup Failed" }),
        };
    }
};

export const getUserFromDb = async (userName: string): Promise<any> => {
    const params = {
        TableName: process.env.USERS_TABLE || "",
        KeyConditionExpression: "UserName = :userName",
        ExpressionAttributeValues: {
            ":userName": userName,
        }
    };

    try {
        const data = await dynamodb.query(params).promise();
        return data.Items;
    } catch (error) {
        console.log("Error occurred while scanning data from DynamoDB", error);
        return null;
    }
};

export const loginController = async (userName: string, password: string): Promise<response> => {
    try {
        if(!userName || !password) {
            return {
                statusCode: 400,
                body: "Login details are missing"
            };
        }
        
        if (!password) {
            return {
                statusCode: 500,
                body: "User password is missing",
            };
        }
    
        const user = await getUserFromDb(userName);
        
        if (!user || user.length === 0 || !user[0].Password) {
            return {
                statusCode: 404,
                body: "User not found",
            };
        }
    
        const userPassword = user[0].Password;
    
        const isMatch = await bcrypt.compare(password, userPassword);
        
        if (!isMatch) {
            return {
                statusCode: 401,
                body: "Invalid password",
            };
        } else {
            const secretKey = process.env.JWT_SECRET || "";
            const token = jwt.sign({UserName: userName}, secretKey, {
                expiresIn: 3600
            });
    
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Login successful", token })
            };
        }
  
    } catch(error) {
        console.error("Error while login:", error);
    
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Login Failed!" }),
        };
    }
};

export const getUserController = async (token: string): Promise<response> => {
    try {
  
        const secretKey = process.env.JWT_SECRET || "";
  
        const decodedToken: any = jwt.verify(token, secretKey);
    
        if(!decodedToken || !decodedToken.UserName) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Unauthorized" }),
            };
        }
  
        const userName = decodedToken.UserName;
  
        const user = await getUserFromDb(userName);
  
        if(!user) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "User not found" })
            };
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ user })
        };
    } catch (error) {
        console.error("Error while fetching table items:", error);
    
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed fetching table items" }),
        };
    }
};
  
export const updateUserController = async (token: string, name: string, userName: string, role: string): Promise<response> => {
    try {
      
        const secretKey = process.env.JWT_SECRET || "";

        const decodedToken: any = jwt.verify(token, secretKey);

        if(!decodedToken || !decodedToken.UserName) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Unauthorized" }),
            };
        }

        const userNameFromToken = decodedToken.UserName;

        const user = await getUserFromDb(userNameFromToken);

        const mobile = user[0].MobileNumber;

        const updateExpression = "SET #name = :name, #role = :role";
        const expressionAttributeNames = {
            "#name": "Name",
            "#role": "Role",
        };
        const expressionAttributeValues = {
            ":name": name,
            ":role": role,
        };

        const params = {
            TableName: process.env.USERS_TABLE || "",
            Key: {
                "UserName": userName,
                "MobileNumber": mobile
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "ALL_NEW"
        };

        const data = await dynamodb.update(params).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Profile updated successfully!" })
        };

    } catch(error) {
        console.error("Error while updating user profile:", error);
    
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to update user profile" }),
        };
    }
};

export const changePasswordController = async (token: string, userName: string, oldPassword: string, newPassword: string): Promise<response> => {
    try {
        const secretKey = process.env.JWT_SECRET || "";

        const decodedToken: any = jwt.verify(token, secretKey);

        if(!decodedToken || !decodedToken.UserName) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Unauthorized" }),
            };
        }

        const userNameFromToken = decodedToken.UserName;

        const user = await getUserFromDb(userNameFromToken);

        const mobile = user[0].MobileNumber;

        const oldPasswordMatch = await verifyPassword(userName, oldPassword, mobile);

        if(!oldPasswordMatch) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Old password is incorrect" }),
            };
        }

        const passwordHash = await bcrypt.hash(newPassword, 8);
        const updatedUser = await updatePassword(userName, passwordHash, mobile);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Password changed successfully", updatedUser })
        };

    } catch(error) {
        console.error("Error while changing password:", error);
    
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Changing password failed" }),
        };
    }
};

const verifyPassword = async (userName: string, password: string, mobile: string) => {
    const user = await getUserFromDb(userName);

    const passwordFromDb: string = user[0].Password;

    if(!passwordFromDb || passwordFromDb?.length === 0) {
        return false;
    }

    return await bcrypt.compare(password, passwordFromDb);
};

const updatePassword = async (userName: string, password: string, mobile: string) => {
    try {

        const params = {
            TableName: process.env.USERS_TABLE || "",
            Key: {
                "UserName": userName,
                "MobileNumber": mobile
            },
            UpdateExpression: "SET Password = :password",
            ExpressionAttributeValues: {
                ":password": password
            }
        };

        const updatedUser = await dynamodb.update(params).promise();
        return updatedUser;

    } catch(error) {
        console.error("Error while updating password:", error);
        throw error;
    }
};