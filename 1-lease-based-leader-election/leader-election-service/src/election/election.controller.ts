import { Controller, Get, Post } from "@nestjs/common"
import { ElectionService } from "./election.service"

@Controller("api/election")
export class ElectionController {
    constructor(private readonly service: ElectionService) {}

    @Get("status")
    status() {
        return this.service.status()
    }

    @Post("simulate-crash")
    crash() {
        return this.service.simulateCrash()
    }
}
