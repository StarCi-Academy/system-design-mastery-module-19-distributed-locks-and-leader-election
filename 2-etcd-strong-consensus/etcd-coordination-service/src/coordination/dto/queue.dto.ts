import { IsNotEmpty, IsString } from "class-validator"

export class JoinQueueDto {
    @IsString()
    @IsNotEmpty()
    queueName!: string

    @IsString()
    @IsNotEmpty()
    clientId!: string
}
