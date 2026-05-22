import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { AcquireDto, ReleaseDto, WriteDto } from "./dto"
import { RedlockService } from "./redlock.service"

@Controller("api/redlock")
export class RedlockController {
    constructor(private readonly service: RedlockService) {}

    @Post("acquire")
    acquire(@Body() body: AcquireDto) {
        return this.service.acquire(body.resource, body.ttlMs)
    }

    @Post("release")
    release(@Body() body: ReleaseDto) {
        return this.service.release(body.resource, body.token)
    }

    @Post("write")
    write(@Body() body: WriteDto) {
        return this.service.write(body.resource, body.fencingToken, body.value)
    }

    @Get("safety-demo")
    safety(@Query("resource") resource = "demo_resource") {
        return this.service.safetyDemo(resource)
    }
}
