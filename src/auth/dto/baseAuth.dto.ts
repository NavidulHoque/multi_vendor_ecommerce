import {
    IsNotEmpty,
    IsString
} from 'class-validator';

export class BaseAuthDto {

    @IsString()
    @IsNotEmpty({ message: "Email is required" })
    email: string;
}