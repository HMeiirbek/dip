import * as fs from 'fs';

let content = fs.readFileSync('src/admin/admin.service.ts', 'utf8');

// replace callerId, calleeId, caller, callee access with host and participant logic in moderationOverview calls loop
content = content.replace(/const callerSession = sessionById.get\(call\.callerId\);\s*const calleeSession = sessionById.get\(call\.calleeId\);/g, `const callerId = call.hostId;
      const calleeParticipant = call.participants.find(p => p.userId !== call.hostId);
      const calleeId = calleeParticipant ? calleeParticipant.userId : call.hostId;
      const callerSession = sessionById.get(callerId);
      const calleeSession = sessionById.get(calleeId);`);

content = content.replace(/expiresAt: call\.expiresAt,/g, `expiresAt: undefined,`);

content = content.replace(/id: call\.callerId,\s*username: call\.caller\?\.username \|\| call\.callerId,\s*online: onlineSet\.has\(call\.callerId\),/g, `id: callerId,
          username: call.host?.username || callerId,
          online: onlineSet.has(callerId),`);

content = content.replace(/id: call\.calleeId,\s*username: call\.callee\?\.username \|\| call\.calleeId,\s*online: onlineSet\.has\(call\.calleeId\),/g, `id: calleeId,
          username: calleeParticipant?.user?.username || calleeId,
          online: onlineSet.has(calleeId),`);

// fix findUnique for call QualityHistory
content = content.replace(/const call = await this\.prisma\.call\.findUnique\({\s*where: { id: callId },\s*include: {\s*caller: { select: { id: true, username: true } },\s*callee: { select: { id: true, username: true } },\s*},\s*}\);/g, `const call = await this.prisma.room.findUnique({
      where: { id: callId },
      include: {
        host: { select: { id: true, username: true } },
        participants: { include: { user: { select: { id: true, username: true } } } },
      },
    });`);

content = content.replace(/actorId: call\.callerId,\s*actorName: call\.caller\?\.username \|\| call\.callerId,/g, `actorId: call.hostId,
      actorName: call.host?.username || call.hostId,`);

content = content.replace(/actorId: call\.calleeId,\s*actorName: call\.callee\?\.username \|\| call\.calleeId,/g, `actorId: call.participants.find(p => p.userId !== call.hostId)?.userId || call.hostId,
        actorName: call.participants.find(p => p.userId !== call.hostId)?.user?.username || 'unknown',`);

// fix call object in history return
content = content.replace(/caller: call\.caller,\s*callee: call\.callee,/g, `caller: call.host,
        callee: call.participants.find(p => p.userId !== call.hostId)?.user || { id: call.hostId, username: call.host?.username },`);

// fix `forceEndCall`
content = content.replace(/const call = await this\.prisma\.call\.findUnique\({ where: { id: callId } }\);/g, `const call = await this.prisma.room.findUnique({ where: { id: callId }, include: { participants: { include: { user: true } } } });`);
content = content.replace(/const updated = await this\.prisma\.call\.update\(\{/g, `const updated = await this.prisma.room.update({`);

// fix this.callEvents.emitEnded
content = content.replace(/this\.callEvents\.emitEnded\({\s*callId: updated\.id,\s*callerId: call\.callerId,\s*calleeId: call\.calleeId,/g, `this.callEvents.emitEnded({
      callId: updated.id,
      callerId: call.hostId,
      calleeId: call.participants.find(p => p.userId !== call.hostId)?.userId || call.hostId,`);

// fix userDetail calls history
content = content.replace(/const calls = user\.role === 'admin'/g, `const calls = user.role === 'admin'`);
content = content.replace(/await this\.prisma\.call\.findMany\({\s*orderBy: { createdAt: 'desc' },\s*take: 100,\s*include: {\s*caller: { select: { id: true, username: true } },\s*callee: { select: { id: true, username: true } },\s*},\s*}\)/g, `await this.prisma.room.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            host: { select: { id: true, username: true } },
            participants: { include: { user: { select: { id: true, username: true } } } },
          },
        })`);
content = content.replace(/await this\.prisma\.call\.findMany\({\s*where: { OR: \[\{ callerId: userId \}, \{ calleeId: userId \}\] },\s*orderBy: { createdAt: 'desc' },\s*take: 100,\s*include: {\s*caller: { select: { id: true, username: true } },\s*callee: { select: { id: true, username: true } },\s*},\s*}\)/g, `await this.prisma.room.findMany({
          where: { participants: { some: { userId } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            host: { select: { id: true, username: true } },
            participants: { include: { user: { select: { id: true, username: true } } } },
          },
        })`);

// update callData inside userDetail mapping
content = content.replace(/const isOutgoing = callData\.callerId === userId;/g, `const isOutgoing = callData.hostId === userId;`);
content = content.replace(/counterpart: isOutgoing\s*\?\s*\{\s*id: callData\.calleeId,\s*username: callData\.callee\?\.username \|\| callData\.calleeId,\s*\}\s*:\s*\{\s*id: callData\.callerId,\s*username: callData\.caller\?\.username \|\| callData\.callerId,\s*\}/g, `counterpart: isOutgoing
              ? {
                  id: callData.participants.find(p => p.userId !== callData.hostId)?.userId || callData.hostId,
                  username: callData.participants.find(p => p.userId !== callData.hostId)?.user?.username || 'unknown',
                }
              : {
                  id: callData.hostId,
                  username: callData.host?.username || callData.hostId,
                }`);


// fix sla summary queries
content = content.replace(/this\.prisma\.call\.findMany\({\s*where: { createdAt: { gte: minDate } },\s*select: { createdAt: true, startedAt: true, status: true },\s*}\)/g, `this.prisma.room.findMany({
        where: { createdAt: { gte: minDate } },
        select: { createdAt: true, startedAt: true, status: true },
      })`);

// fix analytics queries
content = content.replace(/const calls = await this\.prisma\.call\.findMany\({\s*where: { createdAt: { gte: minDate } },\s*select: { createdAt: true, status: true },\s*}\);/g, `const calls = await this.prisma.room.findMany({
      where: { createdAt: { gte: minDate } },
      select: { createdAt: true, status: true },
    });`);

content = content.replace(/WHERE call_id = \$1/g, 'WHERE room_id = $1');
content = content.replace(/call_id = \$1/g, 'room_id = $1'); // In ModerationCallFlag


fs.writeFileSync('src/admin/admin.service.ts', content, 'utf8');
