import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { JoinQueueDto } from "./dto"
import { CoordinationService } from "./coordination.service"

@Controller("api/coordination")
export class CoordinationController {
    constructor(private readonly service: CoordinationService) {}

    @Get("cluster-info")
    cluster() {
        return this.service.clusterInfo()
    }

    @Post("join-queue")
    join(@Body() body: JoinQueueDto) {
        return this.service.joinQueue(body.queueName, body.clientId)
    }

    @Get("queue-state")
    state(@Query("queueName") queueName = "default") {
        return this.service.queueState(queueName)
    }

    @Get("raft-demo")
    raft() {
        return this.service.raftDemo()
    }
}
