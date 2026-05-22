import { Module } from "@nestjs/common"
import { RedlockController } from "./redlock.controller"
import { RedlockService } from "./redlock.service"

@Module({
    controllers: [RedlockController],
    providers: [RedlockService],
})
export class RedlockModule {}
