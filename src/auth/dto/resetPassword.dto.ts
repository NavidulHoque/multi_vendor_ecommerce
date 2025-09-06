import { IsNotEmpty, IsString } from "class-validator";
import { BaseAuthDto } from "./baseAuth.dto";

export class ResetPasswordDto extends BaseAuthDto {

    @IsNotEmpty()
    @IsString()
    newPassword: string;
}