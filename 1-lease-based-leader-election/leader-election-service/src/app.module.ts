import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { appConfig } from "./config"
import { ElectionModule } from "./election/election.module"

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), ElectionModule],
})
export class AppModule {}
