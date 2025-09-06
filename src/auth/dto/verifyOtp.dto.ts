import { IsNotEmpty, IsString } from "class-validator";
import { BaseAuthDto } from "./baseAuth.dto";

export class VerifyOtpDto extends BaseAuthDto {

    @IsNotEmpty()
    @IsString()
    otp: string;
}