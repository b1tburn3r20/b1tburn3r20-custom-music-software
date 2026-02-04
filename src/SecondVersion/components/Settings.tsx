
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import StatsSettings from "./settings/stats-settings";

const ChatSettings = () => {
  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="icon" variant={"muted_primary"}>
            <Settings />
          </Button>
        </DialogTrigger>
        <DialogContent className="min-h-[400px]">
          <VisuallyHidden>
            <DialogHeader>
              <DialogTitle>Chat Settings</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Here in chat settings you can update the settings on the chat.
            </DialogDescription>
          </VisuallyHidden>
          <Tabs
            className="grid grid-cols-7 gap-1"
          >
            <TabsList
              className="col-span-2 flex flex-col gap-1 h-fit justify-start items-start"
            >
              <TabsTrigger
                className="w-full flex justify-start items-center text-start"
                value="chat_settings"
              >
                Developer
              </TabsTrigger>
              <TabsTrigger
                className="w-full flex justify-start items-center text-start"
                value="appearance"
              >
                Appearance
              </TabsTrigger>
              <TabsTrigger
                className="w-full flex justify-start items-center text-start"
                value="behaviors"
              >
                Behaviors
              </TabsTrigger>
              <TabsTrigger
                className="w-full flex justify-start items-center text-start"
                value="stats"
              >
                Stats
              </TabsTrigger>



            </TabsList>
            <div className="transition-all col-span-5">
              <TabsContent className="w-full" value="chat_settings">
                {/* <ChatSettingsTab /> */}
                developer
              </TabsContent>
              <TabsContent className="w-full" value="appearance">
                {/* <ChatMemberSettings /> */}
                appearance
              </TabsContent>
              <TabsContent className="w-full" value="behaviors">
                {/* <ChatNotificationSettings /> */}
                behaviors
              </TabsContent>
              <TabsContent className="w-full" value="stats">
                {/* <ChatNotificationSettings /> */}
                <StatsSettings />
              </TabsContent>

            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatSettings;
