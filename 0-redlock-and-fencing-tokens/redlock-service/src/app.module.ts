import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { appConfig } from "./config"
import { RedlockModule } from "./redlock/redlock.module"

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), RedlockModule],
})
export class AppModule {}
