import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { appConfig } from "./config"
import { CoordinationModule } from "./coordination/coordination.module"

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), CoordinationModule],
})
export class AppModule {}
