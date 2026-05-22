import { IsInt, IsNotEmpty, IsString, Min } from "class-validator"

export class AcquireDto {
    @IsString()
    @IsNotEmpty()
    resource!: string

    @IsInt()
    @Min(100)
    ttlMs!: number
}

export class ReleaseDto {
    @IsString()
    @IsNotEmpty()
    resource!: string

    @IsString()
    @IsNotEmpty()
    token!: string
}

export class WriteDto {
    @IsString()
    @IsNotEmpty()
    resource!: string

    @IsInt()
    @Min(1)
    fencingToken!: number

    @IsString()
    @IsNotEmpty()
    value!: string
}
