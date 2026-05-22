import { Module } from "@nestjs/common"
import { CoordinationController } from "./coordination.controller"
import { CoordinationService } from "./coordination.service"

@Module({
    controllers: [CoordinationController],
    providers: [CoordinationService],
})
export class CoordinationModule {}
